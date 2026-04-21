---
type: instruction
name: code-search
scope: workflow
domain: development
narrativeTemplate:
  prefix: "Apply"
  suffix: "to explore the codebase"
---
# Code Search

Efficient codebase exploration strategies. Find what you need without drowning in results.

## Strategy: Start Narrow, Widen If Needed

1. Search for the exact symbol name first
2. If no results, search for partial matches
3. Use file type filters to reduce noise
4. Search in likely directories first

## Techniques

### Find Definitions
- Search for `function functionName`, `class ClassName`, `def method_name`
- Use AST-aware tools (ast-grep) when available

### Find Usages
- Search for the symbol name across the codebase
- Filter by file extension to focus on source (not tests/docs)
- Check imports to understand dependency direction

### Trace Data Flow
- Start from the entry point (API handler, event listener)
- Follow function calls downstream
- Note transformations and side effects

## Rules
- Never grep the entire repo without filters
- Prefer semantic search (AST) over text search when available
- Always check both definition and usage sites
- Read surrounding context, not just the matching line
