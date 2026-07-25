---
name: develop-idea
description: Iterative idea development — thin wrapper that resolves a TODO.md idea, delegates design to superpowers:brainstorming when that plugin is installed (inline fallback otherwise), then routes by scope (superpowers:writing-plans or /speckit-specify)
allowed-tools: Read Glob Grep Write Edit AskUserQuestion Skill
---

## User Input

$ARGUMENTS

## Goal

Develop a raw idea into an approved design. This skill is a thin wrapper: it
resolves the idea and its captured context from TODO.md, delegates the
collaborative Q&A and design work to `superpowers:brainstorming` when that
plugin is installed (or runs the same steps itself via the step 3b inline
fallback otherwise), records the outcome back to TODO.md, and routes the
approved design by scope — day-scale work continues into
`superpowers:writing-plans` (or straight to writing the plan, without the
plugin), multi-session features go to `/speckit-specify`.

## When to Use

- When exploring a new idea before committing to a path
- When `/quickstart` suggests "Develop idea" from the backlog
- To flesh out a `[Raw]` or `[Developing]` idea in TODO.md

**NOT for**: Ideas already promoted to specs (use `/speckit-specify` instead,
if Spec-Kit is installed).

## Execution

### 1. Header

```
===================================================================
  DEVELOP IDEA
  Date: [YYYY-MM-DD]
===================================================================
```

### 2. Resolve Idea

**If $ARGUMENTS provided**: Use as the idea name/description. If it matches an
existing "Ideas Backlog" entry in TODO.md (the usual case when `/quickstart`
hands off), read that entry's full body and any already-captured bullets first
so the design dialogue builds on existing context instead of starting cold.

**If no arguments**: Read `TODO.md` and present backlog ideas:

Use AskUserQuestion:
- Question: "Which idea would you like to develop?"
- Options: List each idea from the "Ideas Backlog" section with its status tag
- Include "Add new idea" as a final option

### 3. Design via superpowers:brainstorming

The superpowers plugin is optional (`claude plugin install superpowers@claude-plugins-official`).

**If `superpowers:brainstorming` is available**: invoke it via the Skill tool, passing
the idea name plus ALL captured TODO.md context (existing bullets, status).
Brainstorming owns the dialogue from here: one-at-a-time clarifying questions, 2-3
approaches with a recommendation, sectioned design presentation, a design doc
in `docs/superpowers/specs/`, and the user spec-review gate.

**If it is not available**: run step 3b instead. Do not skip the design phase, and do
not jump straight to a plan.

Either way, while the design runs, mirror durable answers as bullets under the idea's
TODO.md entry and set the status to `[Developing]` if currently `[Raw]`.

### 3b. Inline design loop (fallback)

Run this yourself when the superpowers plugin is not installed. Same outputs, no plugin.

1. **Clarify, one question at a time.** Ask a single question, wait for the answer, then
   ask the next. Cover, in order: the problem being solved, who it is for, what is
   explicitly out of scope, hard constraints (existing code, data, deadlines), and how
   you will know it worked. Stop when the next question would not change the design.
2. **Restate.** Summarize the problem, users, in/out of scope, and constraints in your
   own words. Get explicit confirmation before designing.
3. **Offer 2-3 approaches.** For each: a one-line description, what it costs, what it
   risks, and what it forecloses. Recommend one and say why. Never present a single option.
4. **Present the design in sections**, pausing for feedback after each: data and state
   shape, control flow, external surfaces (APIs, files, CLI), failure modes, and what is
   deliberately not built.
5. **Write the design doc** to
   `docs/superpowers/specs/YYYY-MM-DD-<idea-slug>-design.md` with the sections: Problem,
   Constraints, Approaches considered, Chosen design, What breaks, Open questions. Same
   path and shape brainstorming would have produced, so step 4 onward is unchanged.
6. **Spec-review gate.** Ask the user to approve the written design before continuing to
   step 4 below. Do not proceed on implied approval.

### 4. Scope Gate

After the user approves the design, use AskUserQuestion:
- Question: "Design approved. What scope is this work?"
- Options:
  - "Day-scale — direct" — hours-to-a-day of work; status `[Ready: Direct]`
  - "Multi-session — spec-kit" — numbered spec, weeks of work, many tasks;
    status `[Ready: Spec]`
  - "Pause for now" — keep as `[Developing]`, exit

### 5. Update TODO.md + Brief

Update the idea's TODO.md entry: set the chosen status heading, ensure all
captured details are recorded under it. Then emit:

```
IDEA BRIEF: [Idea Name]
---------------------------------------------------------------------
Problem:     [One-sentence problem statement]
Users:       [Who benefits]
Scope:       [What's in / out]
Design doc:  [docs/superpowers/specs/ path written by brainstorming, or by step 3b if the plugin was not installed]

Path:   [Direct — superpowers:writing-plans | Spec-Kit — /speckit-specify]
Status: [[Ready: Direct] | [Ready: Spec]] in TODO.md
---------------------------------------------------------------------
```

### 6. Handoffs

- **`[Ready: Direct]`** → continue the natural handoff: invoke
  `superpowers:writing-plans` against the design doc when that plugin is installed;
  otherwise write the plan yourself into `docs/superpowers/plans/` — task-by-task, each
  task naming its files, its failing test, and its verification command.
  `/session-end` prompts TODO removal on completion.
- **`[Ready: Spec]`** → compose an enriched feature description (original
  TODO.md prose + all captured bullets + design-doc summary, one coherent
  paragraph) and invoke `/speckit-specify [enriched description]` via the
  Skill tool. Do not pass just the idea name. `/quickstart` auto-removes the
  TODO entry once a matching `specs/` directory exists.
- **Paused** → keep `[Developing]`; revisit later.

## Output

```
===================================================================
  IDEA DEVELOPED: [Idea Name]
  Status: [Ready: Direct | Ready: Spec | Developing | Paused]
  Design doc: [path | n/a if paused]
  Next: [Suggested action]
===================================================================
```

## Examples

```bash
# Develop a specific idea
/develop-idea offline-mode

# Develop from backlog (interactive selection)
/develop-idea

# Develop a brand new idea
/develop-idea "real-time notifications for admin dashboard"
```
