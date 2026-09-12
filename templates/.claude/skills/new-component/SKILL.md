---
name: new-component
description: Scaffold a new UI component following project conventions. Classifies type, invokes design review, and creates file with proper structure. Use when user asks to "add a button", "create a card", "build a modal", or any new visual element. Trigger for any new React component creation.
---

# New Component

Scaffold a new UI component following OutputEase monorepo conventions.

## Usage

Invoke with `/new-component <ComponentName>`

Where `<ComponentName>` is the PascalCase name of the component.

## When to Use

- When adding a new UI component to the project
- When a feature requires a reusable visual element
- When extracting an inline element into a standalone component

## Do NOT Use When

- Creating non-visual utilities, hooks, or services (just create the file directly)
- The component already exists (extend or modify the existing one instead)
- Building a page/route layout (use Next.js conventions)

## Procedure

### Step 1: Classify Component Type

Use AskUserQuestion to determine component type:

- **UI primitive** — Reusable, generic (Button variant, Card layout, etc.) -> `packages/ui/src/components/ui/`
- **Shared component** — Used across features but app-specific -> `packages/ui/src/components/`
- **Feature component** — Belongs to a specific app -> `apps/<app-name>/src/components/`

### Step 2: Design Review

If the `/frontend-design` skill is available (installed via plugin), invoke it to design the component. Provide it with:
- Component name and purpose
- Where it will be used
- Any design requirements from the user

If `/frontend-design` is not available, ask the user directly for design requirements (variants, sizing, colors, responsive behavior) before proceeding.

### Step 3: Check Existing Components

Before creating, search for similar existing components:

```
Glob: packages/ui/src/components/**/*.tsx
```

If a similar component exists, ask the user whether to extend the existing one or create a new one.

### Step 4: Create Component File

Based on the design output, create the component at the correct path.

**File naming:** PascalCase filename matching export (e.g., `StatusBadge.tsx`)

**Component template structure:**

```tsx
"use client"; // Only if component uses hooks, event handlers, or browser APIs

import * as React from "react";

import { cn } from "@/lib/utils";

interface ComponentNameProps {
  // Props definition
}

export function ComponentName({ ...props }: ComponentNameProps) {
  return (
    // Component markup using Tailwind CSS and brand tokens
  );
}
```

**Conventions to follow:**
- Import ordering: external -> internal -> types
- Only add `"use client"` when actually needed (hooks, event handlers, browser APIs)
- Use Tailwind CSS with your project's design tokens
- Use `cn()` utility for conditional classes
- Named exports only (no default exports)

### Step 5: Export Component

Update the barrel file to export the new component:
- For UI primitives: update your UI barrel (e.g. `src/components/ui/index.ts`)
- For app components: update the relevant barrel file

### Step 6: Create Co-Located Test

Create `ComponentName.test.tsx` alongside the component:
- Include basic render test
- Include accessibility test
- Follow `bun:test` conventions

## Output Format

```
## Component Created

**Name**: ComponentName
**Path**: src/components/[path]/ComponentName.tsx
**Type**: UI primitive / Shared / Feature
**Client-Side**: Yes/No

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|

### Usage
import { ComponentName } from "@/components/ui";
```

## Related Skills

- **a11y-review** — Run after creating a component to validate WCAG 2.1 AA compliance
- **`/frontend-design`** — Automatically invoked during Step 2 for design decisions

## Notes

- Check existing components before creating new ones
- Follow the project's component library patterns (shadcn/ui new-york style)
- All components must be accessible (keyboard navigable, proper ARIA)
- Use your brand color tokens, never hardcode hex values
