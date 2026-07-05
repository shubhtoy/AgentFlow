import type { ParsedFile } from '@agentflow/core/parser-core'

export function concatenate(files: ParsedFile[], targetPath: string): Record<string, string> {
  const sections = files.map(f => {
    const heading = `## ${f.frontmatter?.name || f.title || f.relativePath}`
    return `${heading}\n\n${f.content}`
  })
  return { [targetPath]: sections.join('\n\n---\n\n') + '\n' }
}
