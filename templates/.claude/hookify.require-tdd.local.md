---
name: require-tdd
enabled: false
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: '(packages|apps)[\\/][^\\/]+[\\/]src[\\/](?!.*\.(?:test|spec)\.).*\.(ts|tsx)$'
---

**Consider: `superpowers:test-driven-development`**

You're editing production code. Follow TDD:

1. **RED**: Write a failing test first
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Clean up while tests pass

The superpowers plugin is optional. Without it, apply the RED/GREEN/REFACTOR loop manually.

**If TDD not applicable:** Proceed with your change.
