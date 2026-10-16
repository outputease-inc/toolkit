# Design Guidelines

> **Applicability**: This template is designed for web applications with a
> browser-based frontend. Remove or adapt this file for non-web projects.
> See SETUP.md Step 1, Feature Flags.

<!-- NOTE: Token names below (e.g., --font-heading, --space-4) are illustrative. Replace with your project's actual design token naming convention (CSS custom properties, Tailwind config, Styled System tokens, etc.). -->

Visual language, component patterns, spacing and typography tokens, and brand consistency rules for [PROJECT_NAME].

## Brand Identity

| Property | Value |
|----------|-------|
| Project Name | [PROJECT_NAME] |
| Brand Voice | [BRAND_VOICE_DESCRIPTION] |
| Logo File | `[LOGO_PATH]` |
| Logo Min Size | [MIN_SIZE_PX] x [MIN_SIZE_PX] px |
| Favicon | `[FAVICON_PATH]` |

<!-- TODO: Add logo usage restrictions and brand attribution requirements -->

## Color Palette

### Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Primary | `[PRIMARY_HEX]` | [RGB_VALUES] | Main brand color, primary buttons, active states |
| Primary Dark | `[PRIMARY_DARK_HEX]` | [RGB_VALUES] | Hover states, emphasis, headers |
| Primary Light | `[PRIMARY_LIGHT_HEX]` | [RGB_VALUES] | Backgrounds, subtle highlights |

### Semantic Colors

| Role | Hex | Usage |
|------|-----|-------|
| Background | `[BG_HEX]` | Page background |
| Surface | `[SURFACE_HEX]` | Cards, elevated content |
| Text Primary | `[TEXT_PRIMARY_HEX]` | Body text (high contrast) |
| Text Muted | `[TEXT_MUTED_HEX]` | Secondary information, captions |
| Border | `[BORDER_HEX]` | Dividers, input borders |
| Success | `[SUCCESS_HEX]` | Confirmations, positive feedback |
| Warning | `[WARNING_HEX]` | Caution states, approaching limits |
| Destructive | `[DESTRUCTIVE_HEX]` | Errors, delete actions, critical alerts |

## Typography

### Font Families

| Token | Font Stack | Usage |
|-------|------------|-------|
| `--font-heading` | [HEADING_FONT], system-ui, sans-serif | Headings (h1 -- h6) |
| `--font-body` | [BODY_FONT], system-ui, sans-serif | Body text, paragraphs |
| `--font-mono` | [MONO_FONT], Consolas, monospace | Code blocks, technical labels |
| `[ADDITIONAL_FONT_OR_REMOVE]` | [FONT_STACK] | [USAGE] |

### Type Scale

| Token | Size | Element | Line Height |
|-------|------|---------|-------------|
| `--text-4xl` | 2.441rem | h1 | 1.2 |
| `--text-3xl` | 1.953rem | h2 | 1.2 |
| `--text-2xl` | 1.563rem | h3 | 1.2 |
| `--text-xl` | 1.25rem | h4 | 1.3 |
| `--text-base` | 1rem | Body | 1.5 |
| `--text-sm` | 0.875rem | Labels, captions | 1.5 |

## Spacing System

Based on a 4px grid for consistent visual rhythm.

| Token | Value | Pixels | Common Use |
|-------|-------|--------|------------|
| `--space-1` | 0.25rem | 4px | Icon gaps, tight spacing |
| `--space-2` | 0.5rem | 8px | Inline element gaps |
| `--space-4` | 1rem | 16px | Default component gap |
| `--space-6` | 1.5rem | 24px | Card padding |
| `--space-8` | 2rem | 32px | Section spacing |
| `--space-12` | 3rem | 48px | Section margins |
| `--space-16` | 4rem | 64px | Page-level margins |

## Components

### Buttons

| Variant | Background | Text | Border | Usage |
|---------|------------|------|--------|-------|
| `default` | Primary | Primary foreground | none | Primary actions |
| `secondary` | Secondary | Secondary foreground | none | Secondary actions |
| `outline` | transparent | Primary | Primary | Tertiary actions |
| `ghost` | transparent | Foreground | none | Subtle / inline actions |
| `destructive` | Destructive | white | none | Delete, cancel, dangerous actions |
| `link` | transparent | Primary | none | Inline navigation |

### [ADDITIONAL_COMPONENT_OR_REMOVE]

| Property | Value | Notes |
|----------|-------|-------|
| Background | `[TOKEN]` | [NOTES] |
| Border Radius | `[RADIUS]` | [NOTES] |
| Padding | `[SPACING_TOKEN]` | [NOTES] |

<!-- TODO: Add component patterns for Cards, Forms, Modals as the design system grows -->

## Layout Patterns

| Token | Value | Usage |
|-------|-------|-------|
| `--container-sm` | 640px | Narrow content, forms |
| `--container-md` | 768px | Default content width |
| `--container-lg` | 1024px | Wide content, dashboards |
| `--container-xl` | 1280px | Full-width sections |

Breakpoints: `sm: 640px` | `md: 768px` | `lg: 1024px` | `xl: 1280px`. All styles are **mobile-first**.

## Accessibility

### Color Contrast (WCAG 2.1 AA)

| Foreground | Background | Min Ratio | Applies To |
|------------|------------|-----------|------------|
| Text Primary | Background | 4.5:1 | Normal body text |
| Text Muted | Background | 4.5:1 | Secondary text |
| Primary | Background | 3:1 | Large text, icons, UI elements |
| Destructive | Background | 4.5:1 | Error messages |

### Keyboard Navigation

| Rule | Requirement |
|------|-------------|
| Focus order | Follows visual reading order (DOM order) |
| Focus indicator | 2px solid ring, offset 2px, visible on `:focus-visible` |
| Skip link | "Skip to main content" link at top of every page |
| Interactive elements | All buttons, links, and inputs must be keyboard-reachable |
| Modals / dialogs | Trap focus inside; return focus to trigger on close; Escape dismisses |
| Touch targets | Minimum 44 x 44 px for all interactive elements |
