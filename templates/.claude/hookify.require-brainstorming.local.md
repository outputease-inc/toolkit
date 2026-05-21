---
name: require-brainstorming
enabled: true
event: prompt
action: warn
conditions:
  - field: user_prompt
    operator: regex_match
    pattern: \b(create|build|design)\s+(new\s+)?(component|feature|page|modal|dialog|system|module|app)\b
---

**Consider: Plan Before Implementing**

Your request involves creating new artifacts or features. Before implementing:

- **Single component/artifact**: `/brainstorm` — Explore 2-3 approaches, then implement
- **Multi-step feature**: `/write-plan` — Create a structured plan with review checkpoints
- **Spec-Kit available**: `/speckit.specify` -> `/speckit.plan` -> `/speckit.implement`

**If already planned or a small/contained change:** Proceed directly.
