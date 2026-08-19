# Codex-Style Composer and Pi Attachments

**Status:** Proposed

## Goal

Add the bottom conversation composer missing from the local-session MVP. It must resemble the installed Codex desktop composer, send a Pi prompt, and accept only input Pi can represent faithfully: images and UTF-8 text/code files. Voice, audio, PDFs, Office files, archives, and cloud file uploads remain out of scope.

## Source Alignment

The installed Codex package keeps its web composer in `ChatGPT.app/Contents/Resources/app.asar`. Its renderer uses React with a ProseMirror editor configured for rich text, file mentions, and slash commands. File input uses browser `File`/`FileReader` and multipart transport; dictation and realtime voice use browser media APIs, which this feature does not include.

The installed Pi SDK has a narrower message contract:

- `AgentSession.prompt(text, { images })` accepts `ImageContent` attachments.
- Pi's own `@file` processor converts non-image files to `<file name="…">UTF-8 text</file>` in the prompt.
- There is no binary `FileContent` or audio content part.

Therefore visual/editor architecture follows Codex, while transport follows Pi's actual contract rather than pretending to upload opaque files.

## Scope

### Included

- A bottom-anchored rich-text composer in the main conversation surface.
- ProseMirror for multiline editing, keyboard submission, and a minimal `@` file-reference trigger.
- Native Electron file selection and drag/drop.
- Image attachments (`png`, `jpeg`, `gif`, `webp`) with a thumbnail, remove control, and Pi `ImageContent` delivery.
- UTF-8 text/code attachments with filename chips; their contents are inserted into the outgoing prompt as escaped `<file name="…">…</file>` blocks.
- Pi session send, streamed assistant events, cancellation, and renderer-visible failures from the existing local-session MVP design.
- Composer visual validation against a current same-scale Codex screenshot before claiming alignment.

### Excluded

- Dictation, microphone permission, recording, realtime voice, and audio attachments.
- PDF, Office, archive, executable, and arbitrary binary attachment support.
- Remote/cloud uploads, persistent attachment storage, and upload resume/progress.
- Full Codex editor features such as Markdown formatting commands, skills, browser resources, and worktree controls.

## Architecture

```text
ProseMirror composer + attachment chips
  -> preload: chooseAttachments / removeAttachment / sendMessage
  -> Electron IPC
  -> AttachmentStore + PiRuntime
  -> AgentSession.prompt(textWithTextFiles, { images })
  -> renderer-safe Pi events
```

`AttachmentStore` is main-process only. `chooseAttachments` opens the native picker, validates each selected file, and returns opaque attachment IDs plus safe display metadata. The renderer never reads a local path or file bytes. On send, `PiRuntime` resolves attachment IDs, reads the bytes once, and removes the temporary in-memory records after success or failure.

Validation is intentionally small and strict:

- Images must be a Pi-supported image MIME type and under the configured per-file byte limit.
- Text files must have a text/code MIME type or recognized source extension, be under the configured size limit, and decode as UTF-8 without replacement characters.
- Any other file is rejected before entering renderer state, with a useful filename-specific error.

The outgoing prompt appends one `<file name="…">…</file>` block for each text attachment. Images remain separate `ImageContent` values. The user-authored draft remains separate from attachment expansion so a failed submission keeps the draft and selected attachments intact.

## Renderer Design

The composer owns only draft text, selected attachment metadata, and submission state. Conversation/session state belongs to the conversation view model.

- Place the composer at the lower edge of the main surface, centered with the same restrained width, rounded editor shell, attachment row, utility row, and circular send/cancel control as Codex.
- Use existing application surface tokens and `lucide-react` icons; do not add a component kit or a CSS framework.
- Use ProseMirror directly rather than TipTap: this mirrors Codex's editor layer and avoids a wrapper dependency.
- Enter submits when no suggestion menu is active; Shift+Enter adds a newline; command/Ctrl+Enter always submits.
- The `@` trigger opens a local filtered list of selected files. It is a convenience reference only; selecting it does not grant filesystem access or change attachment transport.

## IPC Contracts

```ts
type AttachmentKind = 'image' | 'text';

interface AttachmentMeta {
  id: string;
  kind: AttachmentKind;
  name: string;
  size: number;
  previewDataUrl?: string;
}

interface ComposerApi {
  chooseAttachments: () => Promise<AttachmentMeta[]>;
  discardAttachments: (ids: readonly string[]) => Promise<void>;
  sendMessage: (input: {
    sessionId: string;
    text: string;
    attachmentIds: readonly string[];
  }) => Promise<void>;
}
```

All IPC input is schema-validated in the main process. Attachment IDs must belong to the current renderer sender and must not be reused after disposal. The main process validates non-empty text-or-attachment submission and converts all errors into renderer-safe codes/messages.

## Test Plan

- Unit tests for attachment classification, invalid UTF-8 rejection, file-size rejection, prompt expansion, and image/text separation.
- Main-process IPC tests proving renderer requests cannot submit unknown or discarded attachment IDs.
- Composer tests for attachment chips, remove action, Enter vs. Shift+Enter, empty-submission disablement, and retained draft after a send failure.
- PiRuntime tests verifying text attachments become prompt blocks and images are passed in `PromptOptions.images`.
- Typecheck, lint, targeted Vitest suite, then a live Electron visual check at the Codex reference viewport.

## Acceptance Criteria

1. A user can compose and submit text, an image, and a text/code file in a Pi session.
2. Images reach Pi as `ImageContent`; text/code content is readable in the Pi prompt without exposing raw local paths to the renderer.
3. Unsupported files are rejected before submission with no partial upload or corrupted prompt.
4. The composer retains draft and attachments after a send failure, and switches to cancel while Pi is running.
5. The resulting layout is visually checked against the installed Codex desktop composer at the same scale.
