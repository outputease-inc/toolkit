---
name: a11y-review
description: Run WCAG 2.1 AA accessibility audit on components or pages. Checks color contrast, keyboard navigation, ARIA labels, semantic HTML, and tap targets. Use after creating or modifying forms, modals, dialogs, interactive elements, or any user-facing UI. Trigger before PR submission for UI changes.
---

# Accessibility Review

Audit components and pages for WCAG 2.1 AA compliance.

## Usage

Invoke with `/a11y-review [component-or-page-path]`

Examples:
- `/a11y-review src/components/Button.tsx`
- `/a11y-review app/page.tsx`

## When to Use

- After creating new components or pages
- Before PR submission for UI changes
- When refactoring component markup or styles
- After adding interactive elements (forms, modals, dialogs)

## Do NOT Use When

- Reviewing non-visual utility code (helpers, hooks with no JSX)
- The target file has no HTML/JSX output
- Running a full project audit (use the `accessibility-reviewer` agent directly instead)

## Procedure

### Step 1: Static Code Analysis

Run the `accessibility-reviewer` agent on the target file(s) for static checks:
- Color contrast patterns
- Keyboard navigation patterns
- ARIA label completeness
- Semantic HTML correctness
- Tap target sizing
- Anti-pattern detection

If the agent is unavailable, check: contrast ratios, keyboard access, ARIA labels, semantic HTML, tap targets.

### Step 2: Runtime Testing (Optional)

If a browser MCP tool is available (Playwright MCP or similar):

1. Navigate to the page containing the component
2. Run accessibility APIs (axe-core or equivalent)
3. Capture accessibility tree snapshot
4. Test keyboard navigation flow
5. Verify focus management

**Skip this step if:** No browser automation is available, or the target is a non-rendered utility component.

### Step 3: Cross-Reference Findings

Combine static and runtime results:
- Deduplicate overlapping findings
- Prioritize: Critical > Warning > Informational
- Map each finding to a WCAG 2.1 success criterion

## Output Format

```
## Accessibility Audit: [component/page name]

### Critical Issues
- [Issue description] at [file:line]
  - WCAG: [criterion number and name]
  - Source: Static | Runtime
  - Fix: [suggested fix]

### Warnings
- [Warning description]

### Passed Checks
- [List of passing criteria]

### Recommendations
- [Optional improvements beyond AA compliance]
```

## Related Skills

- **new-component** — Use a11y-review after scaffolding a new component to validate accessibility
- **`/frontend-design`** — Plugin-provided design skill; considers accessibility but a11y-review provides deeper WCAG validation

## Notes

- The `accessibility-reviewer` agent handles static analysis in parallel
- This skill adds runtime testing and orchestration on top
- For large pages, focus runtime tests on the changed components only
