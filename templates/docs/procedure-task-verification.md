# Task Verification Procedure (Spec-Kit)

Shared procedure used by `/checkpoint` and `/session-end` to ensure tasks.md accuracy.

**If no `specs/` directory exists or no matching feature `tasks.md` is found: Skip this procedure.**

1. **Identify current feature** from git branch name (e.g., `022-ui-ux-redesign` -> Feature 022)
2. **Read** `specs/[feature-number]-[feature-name]/tasks.md`
3. **Cross-reference** conversation history and staged/changed files against tasks.md:
   - For each task worked on, check if it's still marked `[ ]` (incomplete)
4. **If unmarked completions found**, update tasks.md:
   - Mark completed tasks with `[x]`
   - Display: `TASK STATUS UPDATED: [list of updated tasks] | Progress: X/Y tasks complete (N%)`
5. **If no updates needed**, confirm: `tasks.md: Status is accurate (X/Y tasks complete)`
