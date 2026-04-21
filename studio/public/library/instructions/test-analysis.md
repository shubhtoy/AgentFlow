---
type: instruction
name: test-analysis
scope: workflow
description: Analyze test results and identify failures
inputs:
  - test_results
narrativeTemplate:
  prefix: "Use"
  suffix: "to parse the results"
---

# Test Analysis

Parse test output and identify what failed and why.

## Process
1. Run the test suite
2. Parse output for failures
3. For each failure, identify the assertion and expected vs actual
4. Map failures to source code locations
