---
name: require-tdd
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: "(packages|apps)/[^/]+/src/.*\\.(ts|tsx)$"
---

**Consider: Test-Driven Development**

You're editing production code. Follow TDD:

1. **RED**: Write a failing test first
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Clean up while tests pass

**If TDD not applicable:** Proceed with your change.
