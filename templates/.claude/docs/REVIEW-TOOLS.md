# Review Tools — Which One When

There are several review mechanisms available. They map to distinct **moments**, not to each
other — pick by where you are in the loop. (Reconciled 2026-07-01 to the post-audit toolset.)

> The superpowers plugin is optional (`claude plugin install superpowers@claude-plugins-official`).
> Every `superpowers:*` entry below assumes it is installed; without it, run the named local agents
> directly and follow the same discipline manually.

## Decision tree

```
Where are you?
|
+-- Reviewing your own UNCOMMITTED working diff, locally?
|     - Bugs / correctness / security  -> /code-review   (built-in; effort low..max, or `ultra`)
|     - Reuse / simplify / efficiency  -> /simplify      (built-in; cleanup only, applies fixes)
|
+-- About to open a PR, want a local multi-lens pass first?
|     -> superpowers:requesting-code-review
|        (orchestrates the local agents: accessibility-reviewer, i18n-reviewer, dependency-auditor,
|         test-writer — whichever the change touches)
|
+-- Received review feedback (coderabbit, human, agent)?
|     -> superpowers:receiving-code-review
|        (verify technical claims before implementing suggestions)
|
+-- About to claim work complete / ready to merge?
|     -> superpowers:verification-before-completion
|        (evidence via /dev-check before any "done" claim)
|
+-- Security-specific audit (auth, endpoints, pre-deploy)?
|     -> /security-review  (skill; parallel surface-pass engine; security-guidance lens when installed + a focused /code-review pass)
|
+-- Want deep, specialized PR agents (silent failures, type design, comment rot, test coverage)?
|     -> pr-review-toolkit agents  (heavyweight; only if the plugin is installed)
|
+-- PR is open on GitHub?
      -> coderabbit GitHub App reviews it automatically (external; nothing to invoke)
```

## One-liners

| I want to… | Use | Scope |
|------------|-----|-------|
| Catch bugs/security in my working diff | `/code-review` | Uncommitted diff, local |
| Streamline code I just wrote (no bug hunt) | `/simplify` | Uncommitted diff, local |
| Run the local reviewer agents before a PR | `superpowers:requesting-code-review` | Pre-PR, local |
| Verify feedback before acting on it | `superpowers:receiving-code-review` | Post-review, local |
| Prove it's done before saying so | `superpowers:verification-before-completion` | Pre-claim, local |
| Audit security posture | `/security-review` | On-demand, local |
| Deep specialized PR analysis | `pr-review-toolkit` agents | PR-grade, local (if installed) |
| Automatic review once the PR exists | coderabbit GitHub App | GitHub, external |

## Notes

- **Built-in vs plugin.** `/code-review` and `/simplify` are **built-in** Claude Code commands.
  The `code-review` and `code-simplifier` *plugins* duplicate them: if either is installed, prefer
  the built-in and treat the plugin as a candidate for removal. Neither is a declared dependency of
  this repository (`.agents/plugins.json`), and this note says nothing about what any machine has
  installed — `/plugin` answers that.
- **coderabbit is not a local plugin.** It's a GitHub App; it never runs from a skill. Don't
  reintroduce a local coderabbit review-skill reference into any doc or skill.
- **No single "review everything" button.** Local pre-PR (`superpowers:requesting-code-review`) and
  GitHub-side (coderabbit App) are complementary stages, not substitutes.
