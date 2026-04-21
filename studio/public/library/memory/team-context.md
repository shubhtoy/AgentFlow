---
type: memory
name: team-context
editable: true
---
# Team Context

Org-wide knowledge that applies across multiple repositories and projects. This is the equivalent of shared team memory — facts that any team member working on any repo should know.

## What Belongs Here
- Org-wide conventions ("deploy PRs go through #deploy-queue", "all services use structured logging")
- Shared infrastructure ("staging is at staging.internal", "CI runs on GitHub Actions")
- Team structure and ownership ("platform team owns infra/", "security team reviews all auth changes")
- Cross-repo patterns ("all APIs follow the same error response format")
- Org tooling ("use Datadog for monitoring", "PagerDuty for on-call")

## What Does NOT Belong Here
- Project-specific conventions (those go in project-context)
- Personal preferences (those go in user-preferences)
- Decisions specific to one repo (those go in decisions)

## Format

```
[YYYY-MM-DD] Category: <infrastructure | convention | ownership | tooling | process>
Fact: <concise statement>
Scope: <org-wide | team-name>
```

## Read Instructions
- Read when starting work on any repo to understand org context
- Read before making infrastructure or cross-cutting decisions
- Read when the user references team processes or shared services

## Write Instructions
- Write when the user shares org-wide knowledge
- Write when you discover cross-repo patterns
- Verify with the user before writing — org facts affect everyone

## Example Entries

```
[2025-06-01] Category: infrastructure
Fact: All services deploy to AWS ECS via GitHub Actions. Staging auto-deploys on merge to main.
Scope: org-wide

[2025-06-01] Category: convention
Fact: All APIs return errors in the format { "error": { "code": "...", "message": "..." } }.
Scope: org-wide

[2025-06-15] Category: process
Fact: PRs touching auth or payments require security team review before merge.
Scope: org-wide
```
