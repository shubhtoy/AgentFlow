/**
 * Workspace adapter interface.
 * Both server-side (filesystem) and client-side (File System Access API / Git)
 * implement this to provide workspace storage.
 */

export interface WorkspaceFile {
  path: string       // relative to workspace root, e.g. "instructions/coding.md"
  content: string
}

export interface WorkspaceAdapter {
  /** Read a file */
  read(path: string): Promise<string>

  /** Write a file (create or overwrite) */
  write(path: string, content: string): Promise<void>

  /** Delete a file */
  remove(path: string): Promise<void>

  /** Move/rename a file */
  move(from: string, to: string): Promise<void>

  /** List all files recursively (relative paths) */
  list(): Promise<string[]>

  /** Check if a file exists */
  exists(path: string): Promise<boolean>

  /** Create a directory */
  mkdir(path: string): Promise<void>

  /** Read all files (for full parse) */
  readAll(): Promise<WorkspaceFile[]>

  /** Source type */
  type: 'local' | 'git' | 'browser'
}
