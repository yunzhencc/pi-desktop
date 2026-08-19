# Project Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user select and reopen a local project directory, and run each newly created Pi session with that directory as its current working directory.

**Architecture:** A small main-process registry persists only recent workspace metadata and the selected path in `userData/workspaces.json`. The renderer selects only through main-process IPC; PiRuntime receives the selected directory before it lazily creates a session. Worktrees, session lists, and transcript persistence remain outside this slice.

**Tech Stack:** Electron IPC and native directory dialog, Node `fs/promises`, React, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-19-pi-desktop-local-session-mvp-design.md`

## Global Constraints

- The main process owns the native directory picker and validates every selected directory.
- Persist only project path, display name, selection, and last-opened timestamp; never copy Pi transcripts.
- Do not add Git worktree handling, a global store, or a new dependency.

### Task 1: Persistent workspace registry

**Files:**
- Create: `src/main/workspaces.ts`
- Create: `src/main/workspaces.test.ts`

- [x] Write tests for an empty registry, corrupt JSON recovery, persisted selection, and rejecting a missing/non-directory path.
- [x] Run `pnpm exec vitest run src/main/workspaces.test.ts` and confirm the missing module fails.
- [x] Implement `WorkspaceRegistry.load`, `list`, and `select`; write through a temporary sibling file then rename.
- [x] Re-run the focused test and confirm it passes.

### Task 2: Bind the active workspace to Pi and Electron IPC

**Files:**
- Modify: `src/main/pi-runtime.ts`
- Modify: `src/main/pi-runtime.test.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

- [x] Write a failing PiRuntime test asserting the session factory receives the selected workspace and an unselected workspace cannot send.
- [x] Run `pnpm exec vitest run src/main/pi-runtime.test.ts` and confirm failure.
- [x] Add `setWorkspace(path)` that tears down only the cached session when the project changes; create Pi sessions with that path as `cwd`.
- [x] Register `workspaces:get`, `workspaces:pick`, and `workspaces:select`; `pick` uses Electron's open-directory dialog and all routes update PiRuntime only after registry validation.
- [x] Re-run PiRuntime tests and typecheck.

### Task 3: Project selection renderer state

**Files:**
- Modify: `src/renderer/src/pages/home.tsx`
- Modify: `src/renderer/src/pages/home.test.tsx`
- Modify: `src/renderer/src/global.css`

- [x] Write a failing HomePage test for the no-project call-to-action and for selecting a project through the preload API.
- [x] Run `pnpm exec vitest run src/renderer/src/pages/home.test.tsx` and confirm failure.
- [x] Render the workspace picker before the conversation and a compact selected-project control in conversation; reset only the transient transcript after a project switch.
- [x] Re-run the focused renderer test, then `pnpm exec vitest run`, `pnpm run typecheck`, and `pnpm run lint`.
