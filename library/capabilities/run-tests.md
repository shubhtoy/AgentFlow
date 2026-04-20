---
name: run-tests
type: script
command: npm test
description: Execute the project test suite and return pass/fail results.
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
