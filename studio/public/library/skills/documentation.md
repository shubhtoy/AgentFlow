---
name: documentation
domain: content
---
# Documentation

Write documentation that people actually read and find useful.

## Process Steps
1. Identify the audience and their context (developer, operator, executive)
2. Choose the doc type: README, tutorial, reference, architecture, or runbook
3. Write the first draft following the appropriate template
4. Add code examples that are copy-pasteable and runnable
5. Cut 20% — first drafts are always too long
6. Review: read aloud, verify examples work, check all links

## Types of Documentation
- README: what is this, how to get started (5-minute read)
- Tutorial: step-by-step guide for a specific task
- Reference: complete API/config documentation
- Architecture: system design, data flow, decision records
- Runbook: operational procedures for common tasks

## README Template
1. One-line description of what this does
2. Quick start (install + first use in <5 commands)
3. Key features (bullet list)
4. Configuration options
5. Contributing guide link
6. License

## Writing Rules
- Write for the reader who has 2 minutes, not 20
- Lead with the most common use case
- Code examples > prose explanations
- Keep examples copy-pasteable and runnable
- Update docs when you change code (same PR)

## API Documentation
- Every public function/endpoint documented
- Parameters: name, type, required/optional, default, description
- Return value: type, shape, possible errors
- At least one example per endpoint
- Note breaking changes prominently

## Anti-Patterns
- Writing docs after the project is "done" (write alongside code)
- Documenting implementation details that change frequently
- No code examples — prose-only explanations of technical concepts
- Assuming the reader has your context ("as you know...")
- Outdated docs that contradict the actual behavior

## Output Format
A documentation artifact matching the chosen type: README, tutorial with numbered steps, API reference table, architecture diagram with narrative, or runbook with commands.

## Examples

### Example: Write a README for a CLI tool
```markdown
# mytool — Batch file renamer

Rename files in bulk using pattern matching.

## Quick Start
npm install -g mytool
mytool rename "*.txt" --prefix="2024-"

## Features
- Glob pattern matching
- Dry-run mode (--dry-run)
- Undo last rename (mytool undo)
```
