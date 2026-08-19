# Codex Composer Attachments Implementation Plan

> **For agentic workers:** Required execution skill: use `superpowers:subagent-driven-development` or `superpowers:executing-plans`, completing tasks in order and committing only the implementation changes.

**Goal:** Deliver a Codex-style bottom composer in the main content area that can send prompts to a local Pi session and attach image or UTF-8 text/code files.

**Architecture:** Keep the editor and attachment presentation in the renderer. Main process owns selected file paths, validates and reads them, creates Pi `ImageContent` or text prompt content, and owns the Pi session. The preload bridge exposes only renderer-safe metadata and commands; paths and bytes never cross into the renderer.

**Tech stack:** Electron IPC, React, TypeScript, ProseMirror, existing Lucide icons and global CSS, `@earendil-works/pi-coding-agent`, Vitest.

**Design source:** `docs/superpowers/specs/2026-08-19-codex-composer-attachments-design.md`

## Non-negotiable constraints

- Match the shipped Codex composer interaction model: ProseMirror editing surface, native file picker, attachment chips, drag/drop, and a send button that enables only when there is content or an attachment.
- Support only PNG, JPEG, GIF, WebP, plus decodable UTF-8 text/code files. Reject audio, PDF, Office files, archives, and opaque/binary files with a useful inline error.
- Do not add voice capture, audio playback, a generic upload service, or a browser-side file cache.
- This plan supersedes the earlier local-session exclusion only for image attachments: Pi receives images through `PromptOptions.images`; text files are embedded by Pi's existing file-message convention.
- Reuse current renderer styling and icons. Add no dropzone, upload, editor wrapper, or state-management library.

## File map

| Path | Responsibility |
| --- | --- |
| `package.json`, `pnpm-lock.yaml` | Add the direct ProseMirror packages used by the renderer. |
| `src/main/attachments.ts` | Classify, validate, store, preview, and transform selected attachments for Pi. |
| `src/main/attachments.test.ts` | Small focused checks for accepted and rejected attachment types. |
| `src/main/pi-runtime.ts` | Create and own the current Pi `AgentSession`; turn composer input into a Pi prompt and forward session events. |
| `src/main/index.ts` | Register composer IPC handlers and clean up the runtime on app shutdown. |
| `src/preload/index.ts`, `src/preload/index.d.ts` | Expose typed, path-free composer commands and session event subscription. |
| `src/renderer/src/components/chat-composer.tsx` | ProseMirror editor, native file pick/drop, chips, inline failure state, and send control. |
| `src/renderer/src/components/chat-composer.test.tsx` | Renderer behavior tests for attach/remove/submit/disabled controls. |
| `src/renderer/src/pages/home.tsx` | Main-content conversation shell that owns transcript/session state and mounts the composer. |
| `src/renderer/src/router.tsx` | Replace the empty index route with the main-content conversation shell. |
| `src/renderer/src/global.css` | Minimal Codex-aligned composer, chips, editor, and drop-target styling. |

## Task 1: Add the only missing editor dependency and a safe attachment store

**Files:** `package.json`, `pnpm-lock.yaml`, `src/main/attachments.ts`, `src/main/attachments.test.ts`

- [ ] Write failing tests that create temporary image/text/binary files and verify the public attachment operations:
  - image metadata returns an opaque ID, `kind: 'image'`, name, byte size, and a data-URL preview;
  - UTF-8 text/code returns `kind: 'text'` without exposing its path or contents;
  - unsupported extension/MIME and invalid UTF-8 fail with a user-facing reason;
  - removing an ID makes it unavailable for a later send.
- [ ] Install the minimal direct ProseMirror packages: `prosemirror-state`, `prosemirror-view`, `prosemirror-model`, `prosemirror-schema-basic`, `prosemirror-commands`, and `prosemirror-keymap`. Do not add a React editor wrapper.
- [ ] Implement one small `AttachmentStore`, keyed by `crypto.randomUUID()`, holding paths only in main memory for the lifetime of the current draft/session.
- [ ] Use Node built-ins (`fs/promises`, `path`, `Buffer`) for validation and reading. Detect text with strict UTF-8 decoding (`fatal: true`); never guess binary bytes are text.
- [ ] Return the minimal `AttachmentMetadata` object to callers; generate image preview data URLs in main after validation.
- [ ] Run:

  ```bash
  pnpm exec vitest run src/main/attachments.test.ts
  pnpm exec eslint src/main/attachments.ts src/main/attachments.test.ts
  ```

## Task 2: Create the minimal Pi prompt runtime required for a real send

**Files:** `src/main/pi-runtime.ts`, `src/main/pi-runtime.test.ts`

- [ ] Write failing tests around a dependency-injected Pi session seam:
  - a prompt with no attachments calls `session.prompt(text)`;
  - image attachments are passed through `PromptOptions.images` as Pi `ImageContent`;
  - text attachments are appended to the prompt in Pi's `<file name="...">…</file>` format;
  - session update events are transformed to renderer-safe transcript updates and failures are reported as message errors.
- [ ] Implement the smallest `PiRuntime` that lazily creates one `AgentSession` with `createAgentSession({ cwd: process.cwd() })`, retains it for the app lifetime, and exposes `send` plus `dispose`.
- [ ] Read image buffers only at send time and construct `ImageContent` using the supported Pi shape. Read text only at send time so removed attachments cannot be sent.
- [ ] Do not implement provider settings, persistence, multiple chats, tool confirmation UI, or a custom transcript database in this task. Use Pi's configured credentials/session defaults and surface missing-configuration errors to the renderer.
- [ ] Run:

  ```bash
  pnpm exec vitest run src/main/pi-runtime.test.ts
  pnpm exec eslint src/main/pi-runtime.ts src/main/pi-runtime.test.ts
  ```

## Task 3: Bridge the composer safely through Electron IPC

**Files:** `src/main/index.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`

- [ ] Add failing/unit-testable handler functions or a small registered-handler test that verifies the renderer API accepts only attachment IDs and prompt text; it must not accept paths or arbitrary file bytes.
- [ ] Register these main-process commands:
  - `composer:choose-attachments` opens one native file dialog, validates each selected file, and returns accepted metadata plus per-file failures;
  - `composer:remove-attachment` removes an opaque ID;
  - `composer:send` invokes `PiRuntime.send` with prompt text and opaque IDs;
  - `composer:subscribe` forwards normalized session updates to the sending window.
- [ ] Keep dialog selection and all filesystem operations in main. Ensure an IPC sender without a live main window cannot crash the process.
- [ ] Expose a typed `window.api.composer` object through context isolation. Its API returns metadata only and unsubscribes event listeners cleanly.
- [ ] Dispose the Pi runtime and attachment store when the application exits.
- [ ] Run the focused tests and type-check:

  ```bash
  pnpm exec vitest run src/main
  pnpm exec tsc --noEmit
  ```

## Task 4: Replace the blank main route with a lightweight conversation shell

**Files:** `src/renderer/src/pages/home.tsx`, `src/renderer/src/router.tsx`

- [ ] Write a failing component test that verifies the home route renders a clear empty state and the composer, then appends a local user message immediately after send.
- [ ] Create the smallest home component: an accessible scrollable transcript region, a short empty state, and local rendering of normalized Pi updates.
- [ ] Subscribe once on mount to `window.api.composer` updates; remove the listener on unmount. Clear the editable draft only after IPC accepts the send.
- [ ] Replace the index route's `null` component with this home component. Preserve existing sidebar/settings routing and hash navigation.
- [ ] Keep transcript state in this component. Do not introduce a global store or message persistence until there are multiple sessions.
- [ ] Run:

  ```bash
  pnpm exec vitest run src/renderer/src/pages/home.test.tsx
  pnpm exec eslint src/renderer/src/pages/home.tsx src/renderer/src/router.tsx
  ```

## Task 5: Implement the Codex-like ProseMirror composer and attachment controls

**Files:** `src/renderer/src/components/chat-composer.tsx`, `src/renderer/src/components/chat-composer.test.tsx`, `src/renderer/src/global.css`

- [ ] Write failing UI tests for:
  - typing text enables send, and `Mod-Enter`/`Ctrl-Enter` submits;
  - attach invokes the preload picker and renders image/text chips;
  - removing a chip calls the preload removal API and updates the draft;
  - drag/drop calls the same main-process attachment path rather than reading the file in the renderer;
  - unsupported file errors appear in an `aria-live` status and do not discard valid attachments;
  - empty draft with no attachments leaves send disabled.
- [ ] Construct `EditorState` and `EditorView` directly in a React ref. Use the basic schema, history, keymap, and newline behavior needed for a multiline plain-text prompt; do not add rich-text controls that Codex's simple composer does not expose.
- [ ] Render the editor in a single rounded bottom panel: attachment chips above the editing surface, attach button left, small context/status affordance, send button right. Use existing Lucide icons already installed.
- [ ] Use one attach entry point for button and drop. For dropped `File` objects, pass their filesystem path only when Electron exposes it; otherwise show a supported-platform error. Do not use `FileReader` or place bytes in React state.
- [ ] Add compact CSS using current variables and class naming patterns: max-width main composer, focus ring, disabled send state, neutral chip, image thumbnail, and visible drop target. Maintain keyboard focus and labelled controls.
- [ ] Run:

  ```bash
  pnpm exec vitest run src/renderer/src/components/chat-composer.test.tsx
  pnpm exec eslint src/renderer/src/components/chat-composer.tsx
  ```

## Task 6: Verify end-to-end behavior and visual parity

**Files:** only fixes directly required by verification

- [ ] Run all project checks before manual verification:

  ```bash
  pnpm exec vitest run
  pnpm exec tsc --noEmit
  pnpm exec eslint .
  pnpm run build
  ```

- [ ] Launch the desktop app and verify at normal display scale:
  - main route renders the composer at the bottom without hiding the transcript;
  - file picker accepts an image and UTF-8 text file, produces correct chip states, and removes them correctly;
  - PDF/audio/archive/binary selection produces an inline error, not a crash;
  - sending a text-only and an image-plus-text prompt reaches the configured Pi session or visibly reports the expected missing-provider error;
  - keyboard, dark/light appearance, narrow main area, and drag/drop retain usable focus and controls.
- [ ] Compare against the installed Codex composer at the same window scale. Adjust only measured spacing, colors, border radius, and controls; do not claim visual parity from unit tests alone.
- [ ] Inspect `git diff --check` and the complete worktree. Commit only the implementation files for this feature with an imperative message after the checks pass.

## Completion criteria

- The blank main route is replaced by a working bottom composer.
- Image and UTF-8 text/code attachments can be selected, previewed/represented as chips, removed, and passed to Pi without exposing paths or bytes to the renderer.
- Unsupported formats are safely rejected; voice and all audio flows remain absent.
- Sending creates visible local/transcript state and drives a real Pi session when configured.
- Focused tests, complete checks, and a same-scale desktop visual check pass.
