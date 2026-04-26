---
name: run-tests
type: script
command: npm test
description: Execute the project test suite and return pass/fail results with failure details.
parameters:
  testPattern:
    type: string
    description: Glob or regex to filter which tests to run
    required: false
  coverage:
    type: boolean
    description: Whether to collect code coverage
    required: false
outputs:
  - test_results
  - pass_count
  - fail_count
narrativeTemplate:
  prefix: "Run"
  suffix: "after every logical change"
---

# Run Tests

Execute the project's test suite and return results. Parses output for pass/fail counts and failure details.

## When to use

- After making code changes to verify correctness
- Before committing to catch regressions
- During CI/CD pipeline steps
