---
type: condition
name: retry-with-feedback
check: The previous attempt failed or produced unsatisfactory results, and the user has provided specific feedback on what to change
---

# Retry With Feedback

Evaluates whether a retry is needed based on user feedback after a failed or unsatisfactory attempt.

**True when:** The previous attempt failed or was unsatisfactory and the user provided specific feedback for improvement.
**False when:** The previous attempt succeeded, or the user has not provided actionable feedback.
