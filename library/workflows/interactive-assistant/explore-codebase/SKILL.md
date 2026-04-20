---
name: explore-codebase
description: Deep codebase exploration — semantic search, grep, file navigation, architecture mapping
type: step
agent: codebase-explorer
model: claude-sonnet
context:
  max_tokens: 3000
  inputs:
    - ref: instructions/code-search
      scope: full
    - ref: capabilities/source-agent
      scope: full
    - ref: capabilities/read-code
      scope: signature
    - ref: capabilities/grep-search
      scope: signature
    - ref: capabilities/file-search
      scope: signature
    - ref: capabilities/list-directory
      scope: signature
    - ref: memory/facts
      scope: full
  exclude:
    - instructions/implementation-discipline
    - instructions/debugging
    - instructions/refactoring
outputs:
  - name: exploration-results
    format: markdown
    description: Summary of findings — relevant files, architecture notes, code patterns
---

# Explore Codebase

Deep dive into the codebase to answer the user's question about how things work.

## Resources

- Apply {{instructions/code-search}} for exploration strategy
- Query {{capabilities/source-agent}} for semantic understanding
- Use {{capabilities/read-code}} to examine files
- Use {{capabilities/grep-search}} for text pattern matching
- Use {{capabilities/file-search}} to locate files
- Use {{capabilities/list-directory}} to understand structure
- {{memory/facts}}

## Instructions

### Step 1: Start with Semantic Search

Query {{capabilities/source-agent}} with the user's question to get an architectural overview. This gives you the big picture before diving into files.

### Step 2: Narrow Down

Apply {{instructions/code-search}} to find specific code:
- Use {{capabilities/grep-search}} for exact patterns (function names, imports, error messages)
- Use {{capabilities/file-search}} to locate files by name
- Use {{capabilities/list-directory}} to understand directory structure

### Step 3: Read and Understand

Use {{capabilities/read-code}} to examine the relevant files. Focus on:
- Entry points and public APIs
- Data flow through the system
- Key decision points and branching logic

### Step 4: Synthesize

Produce a clear, structured answer:
- What the code does (high level)
- How it works (key components and their interactions)
- Where to find it (file paths and line references)

Write any useful discoveries to {{memory/facts}}.

## Next

Present findings to the user.

→ {{-> nodes/user-review-gate}}

{{<< output.explore-codebase}}
