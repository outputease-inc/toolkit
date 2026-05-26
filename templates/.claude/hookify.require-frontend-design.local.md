---
name: require-frontend-design
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: "packages/ui/src/.*\\.tsx$"
---

**Consider: Frontend Design Review**

You're modifying a UI file. Before making changes, consider:

- WCAG 2.1 AA accessibility compliance
- Mobile-first responsive design
- Internationalization support (translation parity)
- Consistent component patterns

Invoke `/frontend-design` for significant UI changes.

**If already reviewed:** Proceed with your change.
