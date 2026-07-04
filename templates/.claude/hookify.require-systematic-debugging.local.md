---
name: require-systematic-debugging
enabled: true
event: prompt
action: warn
conditions:
  - field: user_prompt
    operator: regex_match
    pattern: \b(bug|broken|crash(es|ing|ed)?|fail(s|ing|ed)?|error|not working|unexpected(ly)?|why (does|is|isn't|doesn't|won't))\b|\b(fix|debug|resolve|troubleshoot)\s
---

**Consider: `superpowers:systematic-debugging`**

Reproduce and find the root cause before proposing any fix. If 3+ fix
attempts fail, stop — likely an architectural problem.

**If already investigated:** Proceed with your fix.
