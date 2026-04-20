---
type: script
command: "grep -rn --include='*.{ext}' '{pattern}' {path}"
parameters:
  pattern:
    type: string
    description: "Regex pattern to search for"
    required: true
  path:
    type: string
    description: "Directory to search in"
    default: "."
  ext:
    type: string
    description: "File extension filter (e.g. js, py, ts)"
  case_sensitive:
    type: boolean
    description: "Whether the search is case-sensitive"
    default: true
  output_mode:
    type: string
    description: "Output: 'content' (matching lines), 'files_with_matches' (file paths only), 'count' (match counts)"
    default: "files_with_matches"
  multiline:
    type: boolean
    description: "Enable cross-line pattern matching"
    default: false
---
# Search Codebase

Search for patterns across the codebase using regex. Built on ripgrep for speed.

## Usage Tips
- Supports full regex syntax: `log.*Error`, `function\s+\w+`
- Filter by file type with ext parameter: `js`, `py`, `ts`
- Literal braces need escaping: use `interface\{\}` to find `interface{}` in Go
- For cross-line patterns like `struct \{[\s\S]*?field`, use `multiline: true`
- Use spawn-agent for open-ended searches requiring multiple rounds
