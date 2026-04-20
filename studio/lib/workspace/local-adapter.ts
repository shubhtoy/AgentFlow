import type { WorkspaceAdapter, WorkspaceFile } from './types'

const fs = require('fs')
const path = require('path')
const { glob } = require('glob')

export function createLocalAdapter(rootDir: string): WorkspaceAdapter {
  const resolve = (p: string) => path.join(rootDir, p)

  return {
    type: 'local',

    async read(p) {
      return fs.readFileSync(resolve(p), 'utf8')
    },

    async write(p, content) {
      const full = resolve(p)
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, content, 'utf8')
    },

    async remove(p) {
      const full = resolve(p)
      if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true })
    },

    async move(from, to) {
      const fullFrom = resolve(from)
      const fullTo = resolve(to)
      fs.mkdirSync(path.dirname(fullTo), { recursive: true })
      fs.renameSync(fullFrom, fullTo)
    },

    async list() {
      return glob.sync('**/*.md', { cwd: rootDir, nodir: true })
    },

    async exists(p) {
      return fs.existsSync(resolve(p))
    },

    async readAll() {
      const paths = await this.list()
      return paths.map((p: string) => ({
        path: p,
        content: fs.readFileSync(resolve(p), 'utf8'),
      }))
    },

    async mkdir(p: string) {
      fs.mkdirSync(resolve(p), { recursive: true })
    },
  }
}
