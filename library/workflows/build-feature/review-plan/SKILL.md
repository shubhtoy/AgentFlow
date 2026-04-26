---
name: review-plan
description: Present implementation plan for user approval
---

# Review Plan

Present the implementation plan from {{<< output.plan-tasks}} to the user for review and approval.

## Process

### 1. Plan Overview

Summarize the plan at a glance:
- Total number of tasks
- Estimated total effort
- Critical path length
- Any tasks flagged as risky or large

### 2. Task Walkthrough

Present the ordered task list. For each task, show:
- What it does and why it's needed
- What it depends on
- How long it should take

Group related tasks visually so the user can see the logical phases.

### 3. Seek Approval

Ask the user:
- Does the scope look right? Anything missing or unnecessary?
- Is the ordering sensible?
- Are the effort estimates reasonable?
- Any tasks you want to reprioritize or defer?

Do not proceed until the user explicitly approves or provides feedback.

{{-> implement | user approved the plan}}
{{-> plan-tasks | user wants plan changes}}
