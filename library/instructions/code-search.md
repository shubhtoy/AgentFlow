---
name: code-search
description: Efficient codebase exploration strategies for finding definitions, usages, and data flows
domain: development
tags:
  - search
  - navigation
  - codebase
---

# Code Search

Efficient codebase exploration strategies. Find what you need without drowning in results.

## Strategy: Start Narrow, Widen If Needed

1. Search for the exact symbol name first
2. If no results, search for partial matches or related terms
3. Use file type filters to reduce noise
4. Search in likely directories first before going repo-wide
5. Limit results — 10 good matches beat 500 noisy ones

## Techniques

### Find Definitions
- Search for `function functionName`, `class ClassName`, `def method_name`
- Use AST-aware tools (ast-grep, LSP go-to-definition) when available
- Check index files and barrel exports for re-exported symbols
- Look at the module's public API surface first

### Find Usages
- Search for the symbol name across the codebase
- Filter by file extension to focus on source (not tests/docs/generated)
- Check imports to understand dependency direction
- Look for string references too — symbols may be used dynamically

### Trace Data Flow
- Start from the entry point (API handler, event listener, main function)
- Follow function calls downstream through each transformation
- Note where data is validated, transformed, or persisted
- Map the complete path from input to output

### Understand Module Boundaries
- Check the directory structure for organizational patterns
- Read index/barrel files to understand public vs. internal APIs
- Look at import patterns to understand dependency direction
- Identify circular dependencies early

## Rules
- Never grep the entire repo without filters — scope your search
- Prefer semantic search (AST, LSP) over text search when available
- Always check both definition and usage sites
- Read surrounding context, not just the matching line
- When exploring unfamiliar code, start with README and entry points
