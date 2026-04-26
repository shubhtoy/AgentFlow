---
name: design-principles
description: Core design principles applied to all technical designs
narrativeTemplate:
  prefix: "Apply these design principles:"
  suffix: "Violating these principles requires explicit justification in the design document."
---

# Design Principles

All technical designs in this workflow MUST adhere to these principles:

- **SOLID** — Single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion
- **KISS** — Keep it simple. Prefer the simplest solution that meets requirements
- **YAGNI** — Don't build what you don't need yet. Avoid speculative generality
- **Separation of Concerns** — Each module handles one responsibility. UI, business logic, and data access stay separate
- **Prefer Composition** — Favor composition over inheritance for flexibility and testability
- **Design for Testability** — Every component should be testable in isolation via dependency injection or clear interfaces
- **Fail Fast** — Validate inputs early, surface errors immediately, never silently swallow failures
