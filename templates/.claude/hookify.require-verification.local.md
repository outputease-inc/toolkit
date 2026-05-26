---
name: require-verification
enabled: true
event: stop
action: warn
conditions:
  - field: transcript
    operator: not_contains
    pattern: "bun run (build|check|lint|typecheck)"
---

**Consider: Verification Before Completion**

Build/lint commands not detected in session. Before stopping, verify:

**Build:**
- [ ] Run `bun run typecheck` — No errors
- [ ] Run `bun run check` — Clean or fixed

**Manual checks:**
- [ ] Dev server loads correctly
- [ ] Changed features work in browser
- [ ] No console errors in DevTools

**If already verified:** Proceed to close session.
