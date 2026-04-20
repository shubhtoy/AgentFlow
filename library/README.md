# AgentFlow Template Library

A curated collection of reusable workflows, skills, tools, templates, interactions, and memory for building AI agent workflows across any domain.

## Workflows

| Workflow | Description |
|---|---|
| agent-builder | Extract intent → design nodes → generate workspace |
| code-review | Scan for issues, analyze patterns, produce a structured report |
| content-pipeline | Research → draft → edit → review gate → publish |
| customer-support | Triage → route (billing/technical/general) → respond |
| data-analysis | Ingest → clean → analyze → visualize → report |
| deploy | Build → test → stage → release with safety gates |
| incident-response | Detect → triage → investigate → mitigate → postmortem |
| onboarding | Welcome → setup → training → checkpoint |
| sales-outreach | Research prospect → personalize → draft → follow-up |

## Skills

| Skill | Domain | Description |
|---|---|---|
| api-design | Development | RESTful/GraphQL API design best practices |
| bug-hunter | Development | Proactively find potential bugs by analyzing code patterns |
| code-review-skill | Development | Systematic code review for correctness and maintainability |
| code-search | Development | Efficient codebase exploration with grep/AST tools |
| code-simplify | Development | 3 parallel review agents: reuse, quality, efficiency |
| codebase-insights | Development | Analyze codebase structure, patterns, and tech stack |
| commit-push-pr | Development | Full branch → commit → push → PR flow |
| context-compression | Development | Compress conversation context preserving essentials |
| data-cleaning | Data | Handle missing values, outliers, normalization |
| database-design | Data | Schema design, indexing, migrations, naming conventions |
| detailed-plan | Planning | Comprehensive execution plan with phases and dependencies |
| documentation | Content | Write docs people actually read — READMEs, APIs, runbooks |
| error-handling | Development | Robust error handling patterns, retry strategies, logging |
| git-commit | Development | Git commit with safety protocol and AI-generated message |
| incident-response | DevOps | Detect → triage → investigate → mitigate → postmortem |
| memory-review | Planning | Review and promote memory entries across layers |
| multi-agent-orchestration | Planning | Coordinate parallel agents on decomposed tasks |
| performance-audit | DevOps | Identify bottlenecks in DB, network, app, and frontend |
| pr-review | Development | Review a pull request with diff analysis |
| prompt-engineering | AI/ML | Structured prompt design, chain-of-thought, few-shot |
| refactoring | Development | Improve code structure safely with tests as a safety net |
| requirements-elicitation | Product | Gather, clarify, and document requirements systematically |
| scheduled-task | DevOps | Schedule recurring tasks with cron expressions |
| security-review | Security | OWASP categories, false-positive filtering, confidence scoring |
| skill-capture | Planning | Interview user to capture session as reusable skill |
| stakeholder-comms | Business | Executive summaries, status updates, escalation formats |
| systematic-debugging | Development | 4-phase root cause analysis with session log analysis |
| task-decomposition | Planning | Break large tasks into small, verifiable units |
| technical-design | Development | Architecture decisions, data models, API contracts |
| test-analysis | Development | Analyze test failures, flaky tests, coverage gaps |
| testing-strategy | Development | Test pyramid, what to test, mocking guidelines |
| verify-changes | Development | Verify code changes work via tests and execution |
| writing-style | Content | Tone, clarity, grammar, audience-appropriate language |

## Tools

| Tool | Type | Description |
|---|---|---|
| read-code | builtin | Read files, images, PDFs, and Jupyter notebooks |
| write-file | builtin | Create or overwrite files |
| edit-file | builtin | Partial file modification via string replacement |
| find-files | builtin | Fast file pattern matching using glob patterns |
| search-codebase | script | Regex search across files with ripgrep |
| web-search | builtin | Search the web for information |
| analyze-image | builtin | Describe/analyze images, screenshots, diagrams |
| spawn-agent | builtin | Launch a sub-agent for complex tasks |
| send-message | builtin | Inter-agent messaging |
| create-team | builtin | Create parallel agent teams |
| create-task | builtin | Create background tasks |
| manage-tasks | builtin | List, inspect, stop background tasks |
| lsp-query | builtin | Language server go-to-definition, find-references |
| schedule-cron | builtin | Cron-based scheduled triggers |
| structured-output | builtin | Generate structured data from JSON Schema |
| run-tests | script | Execute test suite and return results |
| run-shell | script | Execute shell commands with safety rules |
| git-history | script | Query git log, blame, diff |
| lint-code | script | Run linters (ESLint, Pylint, etc.) |
| format-code | script | Auto-format with Prettier, Black, gofmt, etc. |
| diff-files | script | Compare two files with unified diff |
| call-api | script | Make HTTP requests to REST APIs |
| parse-json | script | Parse, validate, and pretty-print JSON |
| validate-schema | script | Validate data against JSON Schema or OpenAPI |
| generate-docs | script | Generate docs from source code |
| generate-chart | script | Create charts from data with matplotlib |
| check-dependencies | script | Audit dependencies for CVEs |
| measure-performance | script | Benchmark execution time and resources |
| deploy-check | script | Verify deployment health |
| send-notification | mcp | Send Slack/email/webhook notifications |
| query-database | mcp | Run read-only database queries |
| create-ticket | mcp | Create issue/ticket in project tracker |
| fetch-url | script | Fetch content from a URL |

## Templates (Conditions)

| Template | Description |
|---|---|
| is-simple | Task is straightforward, skip detailed analysis |
| is-complex | Task requires deep investigation |
| confidence-high | Agent is confident, proceed without extra review |
| confidence-low | Agent is uncertain, escalate or gather more info |
| tests-pass | All tests passing, safe to proceed |
| tests-fail | Tests failing, route back to fix |
| has-errors | Errors detected in output |
| needs-review | Requires human review before proceeding |
| is-approved | Human approved the proposed change |
| is-rejected | Human rejected, needs revision |
| is-urgent | High severity, fast-track response |
| within-budget | Token/cost/time budget not exceeded |
| output-changed | Output differs from baseline, trigger review |
| retry-limit-reached | Max retries exhausted, escalate or abort |
| deadline-approaching | Time running out, reduce scope |
| data-quality-poor | Data has quality issues, route to cleaning |
| security-risk-detected | Vulnerability found, halt and escalate |

## Interactions

| Interaction | Description |
|---|---|
| ask-user | Ask a clarifying question with optional previews |
| approve | Request human approval for high-impact actions |
| request-permission | Request approval before destructive/irreversible actions |
| show-diff | Display proposed changes for review |
| collect-feedback | Gather structured feedback on output |
| confirm-deploy | Confirm before deploying to production |
| confirm-destructive | Confirm before destructive/irreversible actions |
| present-options | Present 2-4 options with trade-offs |
| progress-update | Status update on current task |
| escalate | Escalate to human when agent is stuck |

## Memory

Memory layers flow upward: session-notes → project-context / user-preferences / lessons-learned / team-context.

| Memory | Description |
|---|---|
| decisions | Important decisions and their reasoning |
| user-preferences | User's coding style, tools, conventions |
| lessons-learned | Mistakes made and correct approaches |
| project-context | Architecture, tech stack, domain knowledge |
| team-context | Org-wide knowledge across repositories |
| session-notes | Working notes for later promotion to permanent layers |

## Usage

Copy any item into your `.agentflow/` directory:

```bash
# Copy a full workflow
cp -r library/workflows/code-review/ .agentflow/code-review/

# Copy individual resources
cp library/skills/systematic-debugging.md .agentflow/skills/
cp library/tools/lint-code.md .agentflow/tools/
cp library/templates/tests-pass.md .agentflow/templates/
cp library/interactions/approve.md .agentflow/interactions/
cp library/memory/decisions.md .agentflow/memory/
```

Or use the CLI:

```bash
agentflow add workflow code-review
agentflow add skill systematic-debugging
agentflow add tool lint-code
agentflow add template tests-pass
agentflow add interaction approve
agentflow add memory decisions
```
