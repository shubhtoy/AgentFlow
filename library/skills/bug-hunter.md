---
name: bug-hunter
domain: development
---
# Bug Hunter

Proactively find potential bugs in the codebase by analyzing code patterns, edge cases, and common vulnerability classes.

## Process Steps
1. Identify the scope — which files or modules to analyze
2. Search for common bug patterns: null derefs, off-by-one, race conditions
3. Trace data flow from inputs to outputs looking for unhandled cases
4. Check error handling — swallowed exceptions, missing catch blocks
5. Look for resource leaks — unclosed connections, missing cleanup
6. Report findings with file:line references and severity

## What to Look For
- Null/undefined dereferences without guards
- Off-by-one errors in loops and array access
- Race conditions in async code
- Unhandled promise rejections
- Type coercion bugs (especially in JavaScript/TypeScript)
- Missing input validation at system boundaries
- Resource leaks (file handles, DB connections, event listeners)
- Incorrect error propagation (swallowed errors, wrong error types)
- Stale closures capturing mutable state
- Integer overflow or precision loss

## Output Format
A bug report with: finding description, severity (Critical/High/Medium/Low), affected file:line, explanation of how it could manifest, and suggested fix.

## Anti-Patterns
- Reporting style issues as bugs
- Flagging theoretical issues with no realistic trigger
- Missing the forest for the trees — focus on impactful bugs first
