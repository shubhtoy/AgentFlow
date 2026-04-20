---
name: worked-example
scope: workflow
description: "Part 17: Complete worked example — a full code-review workflow built from scratch"
tags:
  - guide
  - example
  - code-review
  - walkthrough
---

# Part 17 — Complete Worked Example

Here's a minimal but complete workspace: a **code-review** workflow with three nodes.

## Directory Structure

```
.agentflow/
├── AGENTS.md
├── capabilities/
│   ├── read-code.md
│   └── write-file.md
├── instructions/
│   ├── security-review.md
│   └── coding-standards.md
├── memory/
│   └── lessons.md
└── code-review/
    ├── AGENTS.md
    ├── scan/
    │   └── SKILL.md
    ├── analyze/
    │   └── SKILL.md
    └── report/
        └── SKILL.md
```

## `.agentflow/AGENTS.md`

```yaml
---
type: agents
name: code-reviewer
description: Automated code review agent
identity:
  name: Code Reviewer
  role: Senior engineer focused on code quality and security
  constraints:
    - Always check for hardcoded secrets
    - Flag any TODO/FIXME without a linked issue
---

# Code Reviewer

You review code changes for bugs, security issues, and style violations.

## Workflows

- {{-> nodes/code-review}} — Scan → analyze → report

## Capabilities

{{capabilities/read-code}}, {{capabilities/write-file}}

## Instructions

{{instructions/coding-standards}}

## Memory

{{memory/lessons}}
```

## `code-review/AGENTS.md`

```markdown
# Code Review

Systematic code review workflow.

## Nodes
- {{-> nodes/scan}} — Automated scanning (~2000 tok)
- {{-> nodes/analyze}} — Deep pattern analysis (~2500 tok)
- {{-> nodes/report}} — Compile findings into report (~1500 tok)
```

## `code-review/scan/SKILL.md`

```yaml
---
name: scan-code
type: step
entry: true
context:
  max_tokens: 2000
  inputs:
    - ref: instructions/security-review
      scope: full
    - ref: capabilities/read-code
      scope: signature
outputs:
  - name: scan-results
    format: markdown
---

# Scan Code

## Context Budget

~2000 tokens. References:
- {{instructions/security-review}} (~500 tok, resolve now)
- {{capabilities/read-code}} (~100 tok, resolve on use)

## Instructions

### Step 1: Read Changed Files
Use {{capabilities/read-code}} to read all files in the diff.

### Step 2: Automated Checks
Apply {{instructions/security-review}}:
1. Run linter — collect all warnings and errors
2. Check for hardcoded secrets or credentials
3. Verify input validation on all public interfaces
4. Flag any TODO/FIXME/HACK comments

## Next

→ {{-> nodes/analyze}}

{{<< output.scan-code}}
```

## `code-review/analyze/SKILL.md`

```yaml
---
name: analyze-patterns
type: step
context:
  max_tokens: 2500
  inputs:
    - ref: capabilities/read-code
      scope: full
    - ref: memory/lessons
      scope: summary
outputs:
  - name: analysis-results
    format: markdown
---

# Analyze Patterns

## Context Budget

~2500 tokens. References:
- {{capabilities/read-code}} (~100 tok, resolve on use)
- {{memory/lessons}} (~100 tok, resolve at start)

## Instructions

Read the scan results from {{<< output.scan-code}}.

### Step 1: Pattern Analysis
Use {{capabilities/read-code}} to examine the broader codebase context:
1. Does the code follow existing patterns?
2. Are there performance concerns (N+1 queries, unnecessary loops)?
3. Is error handling comprehensive?
4. Are edge cases covered?
5. Is the code testable?

### Step 2: Record Lessons
If you find a new anti-pattern, write it to {{memory/lessons}}.

## Next

→ {{-> nodes/report}}

{{<< output.analyze-patterns}}
```

## `code-review/report/SKILL.md`

```yaml
---
name: review-report
type: step
context:
  max_tokens: 1500
  inputs:
    - ref: capabilities/write-file
      scope: signature
outputs:
  - name: review-report
    format: markdown
---

# Compile Review Report

## Context Budget

~1500 tokens. References:
- {{capabilities/write-file}} (~100 tok, resolve on use)

## Instructions

Read scan results from {{<< output.scan-code}} and analysis from
{{<< output.analyze-patterns}}.

### Step 1: Compile Report
Use {{capabilities/write-file}} to create the report:

1. **Summary**: Overall assessment (Approve / Request Changes / Needs Discussion)
2. **Critical Issues**: Must fix before merge
3. **Suggestions**: Improvements that aren't blocking
4. **Positive Notes**: What was done well
5. **Questions**: Things that need clarification

## Deliverable

A structured code review report saved to the workspace.
```

## What This Demonstrates

- A complete 3-node linear workflow
- Proper context budgets on every node
- Data flow between nodes (`{{<< output.X}}`)
- Memory usage (read + write)
- Entry point declaration
- Capability and instruction references with resolve timing
- Output declarations on every step

---

Next: [Authoring Checklist](18-checklist.md)
