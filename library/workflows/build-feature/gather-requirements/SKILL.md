---
name: gather-requirements
description: Elicit and document feature requirements through structured interview
entry: true
context:
  max_tokens: 4000
outputs:
  - name: requirements
    format: markdown
    description: Structured requirements document
---

# Gather Requirements

Interview the user to understand what they want to build. Use {{skills/context-engineering}} to manage context efficiently — keep the conversation focused and avoid token waste.

## Preparation

Before interviewing, use available tools to understand the existing system:
- {{capabilities/codebase-explorer}} — understand project structure, tech stack, conventions
- {{capabilities/read-code}} — read relevant existing code the feature will touch
- {{capabilities/grep-search}} — find related functionality that already exists
- {{capabilities/file-search}} — locate configuration, schemas, or docs that provide context

This preparation means you ask informed questions, not generic ones.

## Interview Process

Read the interview-template.md context file for the question framework. Follow {{instructions/requirements-elicitation}} for structured elicitation.

### 1. Problem Space (ask first, always)

- What problem are you solving?
- Who is affected and how?
- What does success look like?
- What happens if we don't build this?

### 2. Solution Space (only after problem is clear)

- What should the user experience be?
- What are the inputs and outputs?
- What existing systems does this integrate with?
- What constraints exist (performance, security, compatibility)?

### 3. Edge Cases and Boundaries

- What happens when things go wrong?
- What are the limits (max users, max data, timeout)?
- What's explicitly out of scope?

### 4. Acceptance Criteria

For each requirement, define how to verify it's met. Use {{skills/brainstorming}} if the user is unsure about criteria — help them think through what "done" looks like.

## Output

Produce a structured requirements document as `output.requirements` following {{instructions/requirements-format}}. The document must be complete enough that someone unfamiliar with the conversation could implement from it.

{{-> review-requirements | requirements document is complete}}
