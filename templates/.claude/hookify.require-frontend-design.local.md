---
name: require-frontend-design
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: '(?:packages[\\/]ui[\\/]src|src|components|app)[\\/].*\.tsx$'
---

**Consider: Frontend Design Review**

You're modifying a UI file. Before making changes, consider:

- WCAG 2.1 AA accessibility compliance
- Mobile-first responsive design
- Internationalization support (translation parity)
- Consistent component patterns

If available, use the `frontend-design` skill (frontend-design plugin) for significant UI changes.

**If already reviewed:** Proceed with your change.
