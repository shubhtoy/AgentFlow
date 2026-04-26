---
name: extract-intent
description: Understand what the workflow should accomplish and classify its pattern
entry: true
outputs:
  - name: intent
    format: markdown
    description: Workflow intent — purpose, pattern, node count estimate, key decisions
---

# Extract Intent

Analyze the requirements to understand what kind of workflow is needed.

## Process

1. Identify the core purpose — what does this workflow automate?
2. Classify the pattern — linear pipeline, router/triage, iterative loop, or hybrid
3. Estimate node count and complexity
4. Identify which resource categories are needed (instructions, capabilities, skills)

## Output

Produce `output.intent` with: purpose statement, pattern classification, estimated nodes, and resource needs.

{{-> select-resources | intent is clear}}
