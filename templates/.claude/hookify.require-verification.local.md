---
name: require-verification
enabled: true
event: prompt
action: warn
conditions:
  - field: user_prompt
    operator: regex_match
    pattern: \b(ship( it)?|ready to merge|looks? done|finished)\b
---

**Consider: `superpowers:verification-before-completion`**

Run `/dev-check` and confirm its output before any completion claim.
Evidence before assertions.
