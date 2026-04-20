---
type: script
command: "diff -u {file_a} {file_b} || true"
parameters:
  file_a:
    type: string
    description: "Path to the first file (original)"
    required: true
  file_b:
    type: string
    description: "Path to the second file (modified)"
    required: true
  context_lines:
    type: number
    description: "Number of context lines around changes"
    default: 3
---
# Diff Files

Compare two files and produce a unified diff. Use for code review, change verification, regression detection, or before/after comparisons.
