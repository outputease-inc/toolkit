---
name: require-systematic-debugging
enabled: true
event: prompt
action: warn
conditions:
  - field: user_prompt
    operator: regex_match
    pattern: \b(fix|debug|resolve|troubleshoot)\s+(the\s+)?(bug|error|crash|failure)\b|(broken|not working)
---

**Consider: Systematic Debugging**

Your request suggests a bug or error. Follow a systematic approach:

**Phase 1 - Investigate:** Reproduce the issue, isolate the component
**Phase 2 - Analyze:** Form hypothesis about root cause
**Phase 3 - Test:** Verify hypothesis before fixing
**Phase 4 - Implement:** Make minimal changes, add regression test

**If 3+ fix attempts fail:** Stop — likely an architectural problem.

**If already investigated:** Proceed with your fix.
