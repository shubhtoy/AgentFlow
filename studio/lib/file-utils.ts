/** Shared file-type detection — single source of truth for FileViewer, FileDropZone, and import logic. */

const ext = (path: string) => path.split('.').pop()?.toLowerCase() ?? ''

// ── Classification ──────────────────────────────────────────────────────

export function isMarkdown(path: string): boolean {
  return ext(path) === 'md'
}

const BINARY_EXTS = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff', 'ico', 'svg',
  'mp4', 'webm', 'mov', 'avi',
  'mp3', 'wav', 'ogg',
  'zip', 'gz', 'tar', 'rar', '7z',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'exe', 'bin', 'dll', 'so', 'dylib', 'wasm',
  'doc', 'xls', 'ppt', 'docx', 'xlsx', 'pptx',
])

export function isBinary(path: string): boolean {
  return BINARY_EXTS.has(ext(path))
}

export function isEditable(path: string): boolean {
  return !isBinary(path)
}

// ── Monaco language mapping ─────────────────────────────────────────────

const LANG_MAP: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript', mts: 'typescript',
  json: 'json', jsonc: 'json',
  yaml: 'yaml', yml: 'yaml',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  c: 'c', h: 'c',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  sql: 'sql',
  html: 'html', htm: 'html',
  css: 'css', scss: 'scss', less: 'less',
  xml: 'xml', svg: 'xml',
  graphql: 'graphql', gql: 'graphql',
  dockerfile: 'dockerfile',
  toml: 'ini',
  ini: 'ini', cfg: 'ini',
  env: 'ini',
  csv: 'plaintext',
  txt: 'plaintext',
  log: 'plaintext',
  md: 'markdown',
}

export function getLanguage(path: string): string {
  const name = path.split('/').pop()?.toLowerCase() ?? ''
  // Handle extensionless files like Dockerfile, Makefile
  if (name === 'dockerfile') return 'dockerfile'
  if (name === 'makefile') return 'shell'
  return LANG_MAP[ext(path)] ?? 'plaintext'
}

// ── DocViewer MIME type mapping ─────────────────────────────────────────

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  tiff: 'image/tiff',
  svg: 'image/svg+xml',
  mp4: 'video/mp4', webm: 'video/webm',
  csv: 'text/csv',
  txt: 'text/plain',
  html: 'text/html', htm: 'text/html',
  md: 'text/markdown',
  rtf: 'application/rtf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export function getMimeType(path: string): string {
  return MIME_MAP[ext(path)] ?? 'application/octet-stream'
}

/** File types that DocViewer can render a meaningful preview for */
const PREVIEWABLE_EXTS = new Set([
  'md', 'csv', 'html', 'htm', 'txt',
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tiff',
  'pdf', 'mp4',
])

export function hasPreview(path: string): boolean {
  return PREVIEWABLE_EXTS.has(ext(path))
}
