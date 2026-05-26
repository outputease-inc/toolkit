---
description: Load project documentation by topic for on-demand context
allowed-tools: ["Read", "Glob", "Grep"]
---

## User Input

$ARGUMENTS

## Goal

Search and load project documentation by topic, presenting a structured summary.
Reduces token usage by loading context on-demand instead of including everything
in the system prompt.

## When to Use

- At the start of a task to load relevant documentation
- When you need context about a specific area (auth, testing, API, etc.)
- When switching between different areas of the codebase
- To discover what documentation is available

## Execution

### 1. Parse Topic

**If $ARGUMENTS provided**: Use as the search topic (e.g., `auth`, `testing`, `api`, `db`).

**If no arguments**: List available documentation.

### 2. No-Topic Flow (Discovery Mode)

When no topic is provided:

1. Check for `docs/INDEX.md` or `docs/README.md` — if found, read and present it
2. If no index file, scan available documentation (check if `docs/` exists first):

```bash
# Only list docs/ if the directory exists
test -d docs && ls docs/
ls *.md  # Root-level markdown files
```

3. Present a categorized list:

```
AVAILABLE DOCUMENTATION
---------------------------------------------------------------------
Root Files:
  - CLAUDE.md          - Project configuration and conventions
  - HANDOFF.md         - Session handoff notes
  - TODO.md            - Backlog and ideas

Docs Directory:
  - docs/architecture.md   - System design and tech stack
  - docs/api.md            - API endpoints and schemas
  - docs/testing.md        - Test strategy and frameworks
  - [...]

Usage: /load-context [topic]
  e.g., /load-context auth
        /load-context testing
        /load-context api
---------------------------------------------------------------------
```

### 3. Topic Search Flow

When a topic is provided:

1. **Search `docs/` directory** for files matching the topic:
   - Exact filename match: `docs/[topic].md`
   - Directory match: `docs/[topic]/`

2. **Search root markdown files** for topic mentions:
   - `CLAUDE.md`, `ARCHITECTURE.md`, `TESTING.md`, etc.

3. **Content search** if filename matching finds nothing:
   - Grep `docs/` for the topic keyword
   - Present files that contain relevant content

### 4. Read and Summarize

For each matched file (up to 5 most relevant):

1. Read the file contents
2. Present a structured summary:

```
CONTEXT LOADED: [topic]
---------------------------------------------------------------------
Source: [file path]
Summary:
  - [Key point 1]
  - [Key point 2]
  - [Key point 3]

[If multiple files matched:]
Also loaded:
  - [file path 2] - [one-line description]
  - [file path 3] - [one-line description]
---------------------------------------------------------------------
```

### 5. No Match Found

If no documentation matches the topic:

```
NO MATCH: "[topic]"
---------------------------------------------------------------------
No documentation found for "[topic]".

Available topics:
  - [list available doc file names without extensions]

Tip: Try a broader term, or run /load-context (no args) to see all docs.
---------------------------------------------------------------------
```

## Output

The command outputs the loaded documentation summary directly. No files are
created or modified.

## Examples

```bash
# Load authentication context
/load-context auth

# Load testing documentation
/load-context testing

# Load API documentation
/load-context api

# Load database context
/load-context db

# Discover all available documentation
/load-context
```
