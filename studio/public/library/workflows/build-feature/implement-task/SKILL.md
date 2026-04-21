---
name: implement-task
description: Execute one implementation task — write code, run diagnostics, run tests, verify
type: step
agent: senior-developer
model: claude-sonnet
context:
  max_tokens: 3500
  inputs:
    - ref: instructions/implementation-discipline
      scope: full
    - ref: instructions/code-search
      scope: full
    - ref: instructions/test-analysis
      scope: full
    - ref: capabilities/read-code
      scope: signature
    - ref: capabilities/write-file
      scope: signature
    - ref: capabilities/get-diagnostics
      scope: signature
    - ref: capabilities/run-tests
      scope: signature
    - ref: capabilities/source-agent
      scope: signature
    - ref: memory/decisions
      scope: full
    - ref: memory/lessons
      scope: full
  exclude:
    - instructions/requirements-elicitation
    - instructions/technical-design
    - instructions/task-decomposition
    - instructions/api-design
    - instructions/security-review
outputs:
  - name: code-changes
    format: diff
    description: The code changes made for this task — files created or modified
---

# Implement Task

Execute the next uncompleted task from the implementation plan. This node runs iteratively — once per task — until all tasks are done.

## Resources

- Follow {{instructions/implementation-discipline}} while writing the code
- Apply {{instructions/code-search}} to explore the codebase
- Use {{instructions/test-analysis}} to parse the results
- Use {{capabilities/read-code}} to examine the source files
- Use {{capabilities/write-file}} to create or modify the file
- Run {{capabilities/get-diagnostics}} to check for errors
- Run {{capabilities/run-tests}} to verify correctness
- Query {{capabilities/source-agent}} to understand the codebase architecture
- {{memory/decisions}}
- {{memory/lessons}}

**Do not resolve** {{instructions/requirements-elicitation}}, {{instructions/technical-design}}, or {{instructions/task-decomposition}} — they belong to earlier nodes.

## Inputs

- Requirements from {{<< output.gather-requirements}}
- Design from {{<< output.create-design}}
- Task list from {{<< output.plan-tasks}}

## Instructions

### Step 1: Pick the Next Task

Read the task list from {{<< output.plan-tasks}}. Find the first uncompleted task (not marked `[x]`).

If the task is a **checkpoint task**, use {{runbooks/checkpoint}} to pause and verify with the user.

### Step 2: Understand the Task

Re-read the relevant section of the design from {{<< output.create-design}} for this specific task. Don't re-read the entire design — just the section this task implements.

Check {{memory/decisions}} for relevant past decisions.
If the task involves unfamiliar code, query {{capabilities/source-agent}} to understand the codebase architecture. Apply {{instructions/code-search}} to explore the codebase.

### Step 3: Write the Code

Follow {{instructions/implementation-discipline}} while writing the code:

1. Write the smallest possible change that satisfies the task
2. Follow existing code conventions — use {{capabilities/read-code}} to examine the source files in nearby files
3. Handle errors explicitly — no silent failures
4. Use {{capabilities/write-file}} to create or modify the file

### Step 4: Verify

After every file edit:
1. Run {{capabilities/get-diagnostics}} to check for errors — fix any errors before proceeding
2. Run {{capabilities/run-tests}} to verify correctness — if tests fail, use {{instructions/test-analysis}} to parse the results and fix

### Step 5: Mark Complete

Update the task list: change `- [ ]` to `- [x]` for the completed task.
Use {{capabilities/write-file}} to create or modify the file with the updated task list.

If you made a non-obvious decision, write it to {{memory/decisions}}.
If you hit a gotcha, write it to {{memory/lessons}}.

## Next

After completing the task, check what's next:

→ {{-> nodes/task-completion-gate}}

{{<< output.implement-task}}
{{capabilities/get-diagnostics}}
