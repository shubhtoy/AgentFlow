/**
 * InstructionManager.
 */

import path from 'path'
import fs from 'fs'
import matter from 'gray-matter'

interface ServiceContext {
  rootDir: string
  logger: { error: (obj: unknown, msg: string) => void }
}

interface InstructionDoc {
  name: string
  description: string
  tags: string[]
  content: string
}

export function createInstructionManager(ctx: ServiceContext) {
  const { rootDir, logger } = ctx
  const instructionsDir = path.join(rootDir, 'instructions')
  const cache = new Map<string, InstructionDoc>()

  function parseFile(filePath: string): InstructionDoc {
    const raw = fs.readFileSync(filePath, 'utf8')
    let frontmatter: Record<string, unknown> = {}
    let body = raw
    try {
      const parsed = matter(raw)
      frontmatter = parsed.data || {}
      body = parsed.content
    } catch (err) {
      logger.error({ err }, `Invalid frontmatter in ${filePath}`)
    }
    return {
      name: path.basename(filePath, '.md'),
      description: (frontmatter.description as string) || '',
      tags: (frontmatter.tags as string[]) || [],
      content: body,
    }
  }

  return {
    loadAll() {
      cache.clear()
      if (!fs.existsSync(instructionsDir)) return
      const files = fs.readdirSync(instructionsDir).filter(f => f.endsWith('.md'))
      for (const file of files) {
        const doc = parseFile(path.join(instructionsDir, file))
        cache.set(doc.name, doc)
      }
    },

    getInstructionContext(requestedNames: string[] | null): string {
      const docs: InstructionDoc[] = []
      for (const doc of cache.values()) {
        const isRequested = Array.isArray(requestedNames) && requestedNames.includes(doc.name)
        if (isRequested) docs.push(doc)
      }
      return docs
        .map(d => `<instruction name="${d.name}">\n${d.content}\n</instruction>`)
        .join('\n\n')
    },

    list(): Omit<InstructionDoc, 'content'>[] {
      return Array.from(cache.values()).map(({ name, description, tags }) => ({
        name, description, tags,
      }))
    },

    add(name: string, content: string, options: { description?: string, tags?: string[] } = {}) {
      const fm: Record<string, unknown> = {}
      if (options.description) fm.description = options.description
      if (options.tags && options.tags.length > 0) fm.tags = options.tags
      const fileContent = matter.stringify(content, fm)
      fs.mkdirSync(instructionsDir, { recursive: true })
      fs.writeFileSync(path.join(instructionsDir, `${name}.md`), fileContent, 'utf8')
      cache.set(name, {
        name,
        description: options.description || '',
        tags: options.tags || [],
        content,
      })
    },

    remove(name: string) {
      const filePath = path.join(instructionsDir, `${name}.md`)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      cache.delete(name)
    },
  }
}
