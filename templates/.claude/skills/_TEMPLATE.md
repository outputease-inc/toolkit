---
name: [skill-name]
description: |
  Brief description of what the skill does and when to trigger it.
  Include keywords that help with discovery.
# Supported optional fields: argument-hint, allowed-tools, disable-model-invocation,
#   user-invocable, compatibility, license, metadata
# Use `disable-model-invocation: true` for user-triggered rituals with side effects
#   (session ceremonies, commits, deploys): Claude never auto-fires them AND their
#   description stays out of context (a budget win). Omit it (default) for skills Claude
#   may usefully auto-invoke. CAVEAT: a skill invoked programmatically by ANOTHER skill
#   (via the Skill tool) must stay model-invocable — do not gate a handoff target.
# Exemption: vendored spec-kit skills (speckit-*/SKILL.md) mirror upstream and may
# also use imperative descriptions without the "Use when" trigger required below.
---

<!--
SKILL TEMPLATE v3.0.0
================================================
YAML Frontmatter Requirements:
- name: lowercase/hyphens only, max 64 chars
  Good: "a11y-review", "new-component", "code-review"
  Bad: "I can help you review" or "ReviewCodeForQuality"
- description: third person, max 1024 chars, include WHAT it does AND WHEN to use it
  Good: "Creates database migrations... Use when adding new tables."
  Bad: "I can help you create migrations" or "You can use this to..."

Body Requirements:
- Keep under 500 lines total
- Be concise - only add context Claude doesn't already know
- Use forward slashes in all paths (not backslashes)
- Avoid time-sensitive information
- Use consistent terminology throughout

Quality Checklist:
- [ ] name is descriptive and uses hyphens
- [ ] description is third person with clear triggers
- [ ] Body under 500 lines
- [ ] Procedure has numbered steps
- [ ] Examples show realistic input/output pairs (optional)
- [ ] Related skills are linked (optional)
- [ ] No verbose explanations Claude already knows

DELETE THIS COMMENT BLOCK IN FINAL SKILL
-->

# [Skill Title]

Brief one-sentence summary of what this skill does.

## Usage

Invoke with `/[skill-name] [arguments]`

Examples:
- `/[skill-name] [example-arg-1]`
- `/[skill-name] [example-arg-2]`

## When to Use

- [Trigger condition 1]
- [Trigger condition 2]

## Do NOT Use When

- [Anti-pattern 1 — use [ALTERNATIVE] instead]
- [Anti-pattern 2]

## Procedure

### Step 1: [Action Name]

[Concise instructions - assume Claude knows common concepts]

### Step 2: [Action Name]

[Concise instructions]

### Step 3: [Action Name]

[Concise instructions]

## Output Format

```
[Expected output template]
```

## Examples (optional)

### Example 1: [Scenario Name]

**Input:**
```
[User request or command]
```

**Output:**
```
[Expected result - code, files created, etc.]
```

## Related Skills (optional)

- [skill-name] — When to use instead/after
- [another-skill] — How this complements

## Notes

- [Important caveats or edge cases]
