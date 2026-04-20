---
name: review-gate
description: Human review checkpoint — present edited content for approval before publishing
type: router
agent: review-coordinator
context:
  max_tokens: 500
  inputs:
    - ref: nodes/edit
      scope: output
    - ref: nodes/research
      scope: output
  exclude:
    - instructions/*
    - capabilities/*
outputs:
  - name: review-decision
    format: json
    description: Approval status with feedback if rejected
---

# Review Gate

Human review checkpoint. Present the edited content for approval before publishing. This is a gate — nothing publishes without explicit sign-off.

## Review Package

Present to the reviewer:
1. **The edited draft** — full content
2. **Change summary** — diff from the editor showing what was modified
3. **Source list** — all references used
4. **Metadata** — title, tags, word count, reading time

## Review Criteria

The reviewer should assess:
- [ ] Factual accuracy — are all claims supported?
- [ ] Brand voice — does it sound like us?
- [ ] Legal/compliance — any claims that need legal review?
- [ ] SEO — title, headings, and meta description optimized?
- [ ] Formatting — renders correctly in the target platform?

## Interactions

Use {{runbooks/approve}} to request sign-off.
Use {{runbooks/collect-feedback}} if the reviewer wants changes.
Use {{runbooks/show-diff}} to display the editing changes.

## Routing

{{runbooks/is-approved}} → {{nodes/publish}}
{{runbooks/is-rejected}} → {{nodes/edit}} (with reviewer feedback attached)

## Next

{{runbooks/is-approved}} {{nodes/publish}}
{{runbooks/is-rejected}} {{nodes/edit}}
