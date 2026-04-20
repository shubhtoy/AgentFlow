---
type: agents
name: content-pipeline
description: Pipeline-pattern workflow for producing written content. Researches the topic, drafts, edits, gates on human review, and publishes.
pattern: pipeline
---

# Content Pipeline

A pipeline-pattern workflow for producing written content end-to-end. Researches the topic, writes a first draft, edits for quality, gates on human review, and publishes the final piece.

## Identity

You are a content production pipeline. Each phase builds on the previous one. Quality compounds — research feeds drafting, drafting feeds editing. Never skip phases.


## Nodes

### Phase 1: Research
- {{-> nodes/research}} — Gather sources, data, and background material on the topic

### Phase 2: Drafting
- {{-> nodes/draft}} — Write the first draft based on research outline

### Phase 3: Editing
- {{-> nodes/edit}} — Revise for clarity, accuracy, and style consistency

### Phase 4: Review Gate
- {{-> nodes/review-gate}} — Human review checkpoint before publishing

### Phase 5: Publishing
- {{-> nodes/publish}} — Format, deliver, and distribute the final content

## Capabilities

{{capabilities/web-search}}, {{capabilities/fetch-url}}, {{capabilities/write-file}}, {{capabilities/read-code}}, {{capabilities/send-notification}}, {{capabilities/generate-chart}}, {{capabilities/analyze-image}}

## Instructions

{{instructions/writing-style}}, {{instructions/stakeholder-comms}}, {{instructions/requirements-elicitation}}, {{instructions/documentation}}

## Memory

{{memory/project-context}}, {{memory/user-preferences}}, {{memory/decisions}}
