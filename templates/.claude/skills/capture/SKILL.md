---
name: capture
description: Quick-capture an idea to TODO.md using the AskUserQuestion tool
allowed-tools: Read Write Edit AskUserQuestion
disable-model-invocation: true
---

## User Input

$ARGUMENTS

## Goal

Quick-capture an idea to the TODO.md Ideas Backlog as a `[Raw]` entry. Designed
for speed — record the idea before it's lost, refine it later with `/develop-idea`.

## When to Use

- When an idea emerges during development
- When brainstorming and capturing multiple ideas in succession
- When a code review or conversation surfaces a future improvement

**NOT for**: Fleshing out ideas (use `/develop-idea`), writing formal specs (use `/speckit-specify`).

## Execution

### 1. Gather Idea Content

**If $ARGUMENTS provided**: Use the full argument text as the idea description.

**If no arguments**: Use AskUserQuestion:
- Question: "What idea would you like to capture?"
- Options: Provide 2 generic options but expect the user to select "Other" and type their idea:
  - "Browse existing ideas" — Read TODO.md and list current backlog, then ask again
  - "Cancel" — Exit without changes

### 2. Clean Up and Confirm

From the idea description:

1. **Derive a short title** (2-6 words, sentence case)
2. **Clean up the description** into polished prose:
   - Fix grammar, spelling, and punctuation
   - Expand shorthand into full words (e.g., "auth" → "authentication", "db" → "database") — except well-known technical terms (API, CLI, UI, etc.)
   - Write in complete sentences
   - Keep the same meaning and intent — do not add or remove ideas
   - Keep it concise (one short paragraph, 2-4 sentences max)
   - Match the tone of existing TODO.md entries (professional, third-person descriptive)

Use AskUserQuestion to confirm the entry:
- Question: "Capture this idea?\n\n### `[Raw]` **[Derived Title]**\n\n[Cleaned-up description text]"
- Options:
  - "Capture it" — Proceed to Step 3
  - "Edit title" — Ask for a corrected title via AskUserQuestion, then re-confirm
  - "Cancel" — Exit without changes

### 3. Append to TODO.md

1. Read `TODO.md` from the repo root

2. **If TODO.md does not exist**, create it with this structure:

```markdown
# TODO - Future Feature Ideas

High-level ideas for future development. These are captured as they
emerge and will be refined into formal spec-kit specifications when prioritized.

Ideas progress through stages: `[Raw]` -> `[Developing]` -> `[Ready: Direct]` or `[Ready: Spec]`.
- `[Ready: Direct]` — implement in the current branch, no formal spec needed.
- `[Ready: Spec]` — promote to a formal spec via `/speckit-specify`.

Use `/develop-idea [idea-name]` to collaboratively develop a `[Raw]` idea, then choose Direct or Spec at readiness.
Use `/quickstart` to scan this file and discover promotion candidates.
Use `/speckit-specify [idea-name]` to promote a `[Ready: Spec]` idea to a formal specification.

---

## Ideas Backlog

---

**Last Updated**: [TODAY]
```

3. **Duplicate check**: Scan all H3 headings under `## Ideas Backlog` for a
   case-insensitive match against the derived title. If a match is found,
   use AskUserQuestion to warn:
   - Question: "An idea with a similar name already exists: `### [status] [existing title]`. Add anyway?"
   - Options: "Yes, add as separate entry", "Cancel"

4. **Insert the new entry** immediately before the closing `---` separator
   (the one before `**Last Updated**`):

```markdown

### `[Raw]` [Title]

[Description text]

```

5. **Update the footer** to the exact format `**Last Updated**: YYYY-MM-DD` (today) — a bare date, nothing after it; never append change narrative (CI-enforced).

6. Write the updated file

### 4. Confirm Capture

```
===================================================================
  IDEA CAPTURED: [Title]
  Status: [Raw]
  File: TODO.md
-------------------------------------------------------------------
  Next steps:
  - /develop-idea [title] — flesh out with collaborative Q&A
  - /capture — capture another idea
===================================================================
```

## Examples

```bash
# Capture with inline context
/capture shared auth package with Supabase session management

# Capture interactively (no args)
/capture
```
