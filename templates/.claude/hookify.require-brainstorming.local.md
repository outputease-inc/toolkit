---
name: require-brainstorming
enabled: true
event: prompt
action: warn
conditions:
  - field: user_prompt
    operator: regex_match
    pattern: \b(create|build|design|add|implement|make|write|extend)\s+(a\s+|an\s+|the\s+|new\s+)*(component|feature|page|modal|dialog|system|module|app|skill|command|endpoint|api|route|hook|package|script|workflow)\b
---

**Consider: Plan Before Implementing**

- Day-scale work: `superpowers:brainstorming` (design), then `superpowers:writing-plans`
- Multi-session feature (numbered spec, weeks of work): `/speckit-specify` → `/speckit-plan` → `/speckit-implement`

The superpowers plugin is optional. Without it, apply the same discipline manually:
design before building, then plan before executing.

**If already planned or a small/contained change:** Proceed directly.
