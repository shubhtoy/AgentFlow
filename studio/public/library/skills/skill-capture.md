---
name: skill-capture
domain: planning
---
# Skillify

You are capturing this session's repeatable process as a reusable skill.

## Step 1: Analyze the Session

Before asking any questions, analyze the session to identify:
- What repeatable process was performed
- What the inputs/parameters were
- The distinct steps (in order)
- The success artifacts/criteria (e.g. not just "writing code," but "an open PR with CI fully passing") for each step
- Where the user corrected or steered you
- What tools and permissions were needed
- What agents were used
- What the goals and success artifacts were

## Step 2: Interview the User

Ask the user questions for ALL clarifications. Never ask questions via plain text output. For each round, iterate as much as needed until the user is happy. The user always has a freeform "Other" option — do NOT add your own "Needs tweaking" option. Just offer the substantive choices.

### Round 1: High level confirmation
- Suggest a name and description for the skill based on your analysis. Ask the user to confirm or rename.
- Suggest high-level goal(s) and specific success criteria for the skill.

### Round 2: More details
- Present the high-level steps you identified as a numbered list. Tell the user you will dig into the detail in the next round.
- If you think the skill will require arguments, suggest arguments based on what you observed.
- If it's not clear, ask if this skill should run inline (in the current conversation) or forked (as a sub-agent with its own context). Forked is better for self-contained tasks that don't need mid-process user input; inline is better when the user wants to steer mid-process.
- Ask where the skill should be saved:
  - **This repo** (`.agentflow/skills/<category>/SKILL.md`) — for workflows specific to this project
  - **Personal** (`~/.agentflow/skills/<category>/SKILL.md`) — follows you across all repos

### Round 3: Breaking down each step
For each major step, if it's not glaringly obvious, ask:
- What does this step produce that later steps need? (data, artifacts, IDs)
- What proves that this step succeeded, and that we can move on?
- Should the user be asked to confirm before proceeding? (especially for irreversible actions like merging, sending messages, or destructive operations)
- Are any steps independent and could run in parallel?
- How should the skill be executed? (e.g. always use a Task agent to conduct code review, or invoke an agent team for a set of concurrent steps)
- What are the hard constraints or hard preferences?

You may do multiple rounds here, one round per step, especially if there are more than 3 steps. Iterate as much as needed.

IMPORTANT: Pay special attention to places where the user corrected you during the session, to help inform your design.

### Round 4: Final questions
- Confirm when this skill should be invoked, and suggest/confirm trigger phrases too.
- Ask for any other gotchas or things to watch out for.

Stop interviewing once you have enough information. IMPORTANT: Don't over-ask for simple processes!

## Step 3: Write the SKILL.md

Create the skill directory and file at the location the user chose in Round 2. Use this format:

```markdown
---
name: <skill-name>
description: <one-line description>
allowed-tools: <list of tool permission patterns>
when_to_use: <when Claude should automatically invoke this skill>
argument-hint: "<hint showing argument placeholders>"
arguments: <list of argument names>
context: <inline or fork -- omit for inline>
---
# <Skill Title>

Description of skill

## Inputs
- `$arg_name`: Description of this input

## Goal
Clearly stated goal for this workflow.

## Steps

### 1. Step Name
What to do in this step. Be specific and actionable.

**Success criteria**: What shows this step is done.
```

Per-step annotations:
- **Success criteria** is REQUIRED on every step
- **Execution**: `Direct` (default), `Task agent`, `Teammate`, or `[human]`
- **Artifacts**: Data this step produces that later steps need
- **Human checkpoint**: When to pause and ask the user
- **Rules**: Hard rules for the workflow

Step structure tips:
- Steps that can run concurrently use sub-numbers: 3a, 3b
- Steps requiring the user to act get `[human]` in the title
- Keep simple skills simple — a 2-step skill doesn't need annotations on every step

Frontmatter rules:
- `allowed-tools`: Minimum permissions needed (use patterns like `Bash(gh:*)` not `Bash`)
- `context`: Only set `context: fork` for self-contained skills that don't need mid-process user input
- `when_to_use` is CRITICAL — tells the model when to auto-invoke. Start with "Use when..." and include trigger phrases
- `arguments` and `argument-hint`: Only include if the skill takes parameters

## Step 4: Confirm and Save

Before writing the file, output the complete SKILL.md content as a yaml code block so the user can review it with proper syntax highlighting. Then ask for confirmation.

After writing, tell the user:
- Where the skill was saved
- How to invoke it: `/<skill-name> [arguments]`
- That they can edit the SKILL.md directly to refine it
