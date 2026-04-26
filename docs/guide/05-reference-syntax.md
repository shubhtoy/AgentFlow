---
name: reference-syntax
scope: workflow
description: "Part 5: The four reference types — mentions, edges, conditional edges, data flow"
tags:
  - guide
  - references
  - syntax
  - edges
  - data-flow
---

# Part 5 — Reference Syntax

The parser recognizes exactly four reference patterns. They are the connective tissue of every workflow.

## 1. Mention — `{{category/name}}`

```markdown
Use {{capabilities/read-code}} to examine the source files.
Apply {{instructions/requirements-elicitation}} to structure the requirements.
Read {{memory/decisions}} for past choices.
```

**What it means:** "Load this resource as context for the current node."

**How it resolves:**
1. Path match (primary): looks for `category/name.md`
2. Name match (fallback): searches all files for a frontmatter `name` field matching `name`

**Special case — capabilities:** When the category is `capabilities`, the resource is wired as a callable tool, not just loaded as text.

## 2. Edge — `{{-> nodes/target}}`

```markdown
→ {{-> nodes/create-design}}
```

**What it means:** "After this node completes, transition to this target node."

Creates a directed edge in the workflow graph from the current node to the target.

## 3. Conditional Edge — `{{-> nodes/target | skills/condition}}`

```markdown
- Approved → {{-> nodes/plan-tasks | skills/design-approved}}
- Rejected → {{-> nodes/create-design | skills/design-rejected}}
```

**What it means:** "Transition to this target IF the condition is met."

The condition references a skill file whose `check` field describes when this edge should be taken. The pipe `|` is the separator; whitespace around it is ignored.

## 4. Data Flow — `{{<< output.nodeName}}`

```markdown
Read the requirements from {{<< output.gather-requirements}}.
```

**What it means:** "Read the output produced by a previous node."

Creates a data dependency. At runtime, the executor injects the stored output from the named node into the current node's context.

## Where Refs Can Appear

References work in any markdown context — paragraphs, lists, headings. The parser scans the entire content of every `.md` file for ref patterns.

## Quick Reference Card

| Pattern | Type | Purpose |
|---------|------|---------|
| `{{capabilities/read-code}}` | Mention | Load tool / wire as callable |
| `{{instructions/code-search}}` | Mention | Load instruction module |
| `{{memory/decisions}}` | Mention | Load memory file |
| `{{skills/review-design}}` | Mention | Load interaction definition |
| `{{-> nodes/create-design}}` | Edge | Go here next |
| `{{-> nodes/plan-tasks \| skills/design-approved}}` | Conditional edge | Go here IF condition met |
| `{{<< output.gather-requirements}}` | Data flow | Read previous node's output |

---

Next: [Writing Your Root AGENTS.md](06-root-agents-md.md)
