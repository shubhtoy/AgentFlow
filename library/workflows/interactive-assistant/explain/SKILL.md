---
name: explain
description: Answer questions, explain code, provide documentation
type: step
agent: technical-writer
model: claude-sonnet
context:
  max_tokens: 1500
  inputs:
    - ref: capabilities/read-code
      scope: signature
    - ref: capabilities/web-search
      scope: signature
    - ref: capabilities/source-agent
      scope: signature
    - ref: memory/facts
      scope: full
  exclude:
    - instructions/implementation-discipline
    - instructions/debugging
    - instructions/refactoring
outputs:
  - name: explanation
    format: markdown
    description: Clear explanation of the topic
---

# Explain

Answer the user's question clearly and concisely.

## Resources

- Use {{capabilities/read-code}} to examine relevant code
- Use {{capabilities/web-search}} for external documentation
- Query {{capabilities/source-agent}} for codebase context
- {{memory/facts}}

## Instructions

### Step 1: Understand the Question

What exactly does the user want to know? Is it about:
- A specific piece of code in this project?
- A general programming concept?
- A library, framework, or tool?
- Architecture or design patterns?

### Step 2: Gather Context

- For project code: use {{capabilities/read-code}} and {{capabilities/source-agent}}
- For external topics: use {{capabilities/web-search}}
- Check {{memory/facts}} for previously learned information

### Step 3: Explain

Provide a clear, structured answer:
- Start with the high-level answer (one sentence)
- Then provide details with code examples if relevant
- End with practical implications or next steps

Write new facts to {{memory/facts}} if the research uncovered useful information.

## Next

→ {{-> nodes/user-review-gate}}

{{<< output.explain}}
