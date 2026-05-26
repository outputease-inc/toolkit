---
description: Iterative idea development with collaborative Q&A to produce a structured brief
allowed-tools: ["Read", "Glob", "Grep", "Write", "Edit", "AskUserQuestion"]
---

## User Input

$ARGUMENTS

## Goal

Develop a raw idea into a structured brief through iterative clarification
questions. Produces enough detail to decide whether to promote the idea to a
formal spec, implement it directly in the current branch, add it to the backlog,
or park it.

## When to Use

- When exploring a new idea before committing to a path
- When `/quickstart` suggests "Develop idea" from the backlog
- When brainstorming and you want structured capture
- To flesh out a `[Raw]` or `[Developing]` idea in TODO.md

**NOT for**: Ideas already promoted to specs (use `/speckit-specify` instead, if Spec-Kit is installed).

## Execution

### 1. Header

```
===================================================================
  DEVELOP IDEA
  Date: [YYYY-MM-DD]
===================================================================
```

### 2. Resolve Idea

**If $ARGUMENTS provided**: Use as the idea name/description.

**If no arguments**: Read `TODO.md` and present backlog ideas:

Use AskUserQuestion:
- Question: "Which idea would you like to develop?"
- Options: List each idea from the "Ideas Backlog" section with its status tag
- Include "Add new idea" as a final option

### 3. Iterative Development Loop

Enter a collaborative Q&A dialogue to flesh out the idea:

**Loop iteration:**

1. Use AskUserQuestion to ask ONE clarifying question at a time:
   - First question: "What problem does [idea] solve, and for whom?"
   - Subsequent questions adapt based on previous answers:
     - Scope: "What's in scope vs out of scope?"
     - Behavior: "What should happen when [scenario]?"
     - Constraints: "Are there technical or business constraints?"
     - Dependencies: "Does this depend on other features?"
     - Priority: "How urgent is this relative to current work?"

2. After each answer, record it as a bullet point under the idea in TODO.md

3. Update the idea's status to `[Developing]` if currently `[Raw]`

4. Use AskUserQuestion to check readiness:
   - Question: "The idea now has [N] details captured. What next?"
   - Options:
     - "Continue developing" — ask another clarifying question
     - "Mark ready — Direct" — status `[Ready: Direct]`, implement in current branch (no spec)
     - "Mark ready — Spec" — status `[Ready: Spec]`, formal spec via `/speckit-specify`
     - "Pause for now" — keep as `[Developing]`, exit loop

### 4. Produce Idea Brief

When user selects "Mark ready — Direct" or "Mark ready — Spec", generate a structured brief.

For Direct:

```
IDEA BRIEF: [Idea Name]
---------------------------------------------------------------------
Problem:    [One-sentence problem statement]
Users:      [Who benefits]
Scope:      [What's in / out]
Behavior:   [Key behaviors summarized]
Constraints:[Technical or business constraints]
Dependencies:[Related features or prerequisites]

Path:   Direct — implement in current branch
Status: [Ready: Direct] in TODO.md
---------------------------------------------------------------------
```

For Spec:

```
IDEA BRIEF: [Idea Name]
---------------------------------------------------------------------
Problem:    [One-sentence problem statement]
Users:      [Who benefits]
Scope:      [What's in / out]
Behavior:   [Key behaviors summarized]
Constraints:[Technical or business constraints]
Dependencies:[Related features or prerequisites]

Path:   Spec-Kit — promote via /speckit-specify
Status: [Ready: Spec] in TODO.md
---------------------------------------------------------------------
```

Update TODO.md:
- Change status heading to `[Ready: Direct]` or `[Ready: Spec]` per user choice
- Ensure all captured details are recorded under the heading

### 5. Next Steps

Present path-appropriate options:

**If `[Ready: Direct]`**:
- Begin implementation in this branch (or open a `feat/`/`fix/` branch per repo policy)
- The next `/session-end` will prompt to remove the item from TODO once complete

**If `[Ready: Spec]`**:
- Run `/speckit-specify [idea-name]` to create a formal specification
- `/quickstart` will auto-remove the TODO entry once a matching `specs/` directory exists

**For both**:
- Or keep as `[Developing]` and revisit later

## Output

```
===================================================================
  IDEA DEVELOPED: [Idea Name]
  Status: [Ready: Direct | Ready: Spec | Developing | Paused]
  Details captured: [N] points
  Next: [Suggested action]
===================================================================
```

## Handoffs

When an idea reaches readiness:

- **`[Ready: Direct]`** → implement in the current branch; `/session-end` prompts removal on completion.
- **`[Ready: Spec]`** → run `/speckit-specify [idea-name]` to create a formal specification (Spec-Kit required).

## Examples

```bash
# Develop a specific idea
/develop-idea offline-mode

# Develop from backlog (interactive selection)
/develop-idea

# Develop a brand new idea
/develop-idea "real-time notifications for admin dashboard"
```
