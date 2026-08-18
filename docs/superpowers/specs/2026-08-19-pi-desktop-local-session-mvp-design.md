# Pi Desktop Local Session MVP Design

**Status:** Approved for planning

**Reference implementation:** `minghinmatthewlam/pi-gui` `main` at `eb9a7380705dffad36db3efa771ee825aafbef6f`.

## Goal

Deliver a local-only desktop loop: configure a provider API key, select a local workspace, create or reopen a Pi session, send a prompt, see Pi events stream into the UI, and cancel the active run.

## Scope

The MVP includes:

- Provider status and API-key configuration.
- A persisted list of local workspace directories and a selected workspace.
- Create, list, and reopen Pi JSONL sessions for the selected workspace.
- Text prompts, streamed assistant text, tool activity status, completion, errors, and cancellation.
- A renderer that has Provider Settings, workspace selection, session list, transcript, and composer states.

The MVP excludes OAuth, image attachments, worktrees, integrated terminals, file diffs, multi-agent orchestration, skill and extension management, session archive, and custom provider editing.

## Runtime Architecture

Pi runs in the Electron main process, not in the renderer and not by spawning the `pi` CLI.

```text
React renderer
  -> preload typed API
  -> Electron IPC handlers
  -> PiRuntime
  -> @earendil-works/pi-coding-agent
  -> Pi auth files and workspace JSONL sessions
```

`PiRuntime` is a small application-owned adapter. It creates one shared `ModelRuntime` with the Pi SDK defaults, so Pi's native auth and model files remain the source of truth. It creates and opens sessions with `SessionManager` and `createAgentSession`, keeps only currently opened `AgentSession` instances in memory, and disposes them when the app quits.

The adapter provides these operations:

```ts
interface ProviderSnapshot {
  configuredProviderIds: readonly string[];
  availableModels: readonly { provider: string; id: string; name: string }[];
}

interface PiRuntime {
  getProviderSnapshot: () => Promise<ProviderSnapshot>;
  setApiKey: (providerId: string, apiKey: string) => Promise<ProviderSnapshot>;
  listSessions: (workspacePath: string) => Promise<readonly PiSessionSummary[]>;
  createSession: (workspacePath: string) => Promise<PiSessionSnapshot>;
  openSession: (sessionPath: string) => Promise<PiSessionSnapshot>;
  sendMessage: (sessionId: string, text: string) => Promise<void>;
  cancelRun: (sessionId: string) => Promise<void>;
  dispose: () => void;
}
```

`sendMessage` subscribes to the SDK session before calling `session.prompt(text)`. It forwards a deliberately small, renderer-safe event union: assistant text deltas, tool started/updated/completed status, settled, and an error message. `cancelRun` calls `session.abort()`.

## Persistence

Pi owns provider credentials, model state, and session transcripts. The application does not copy credential values or message bodies into its own store.

The application stores only its UI-level workspace registry in `app.getPath("userData")/workspaces.json`:

```ts
interface WorkspaceRegistry {
  selectedWorkspacePath?: string;
  workspaces: readonly { path: string; displayName: string; lastOpenedAt: string }[];
}
```

Writes use a temporary file followed by rename. An unreadable or missing registry starts as an empty registry. Pi session history is discovered per workspace through `SessionManager.list(workspacePath)` and opened through its persisted session path.

## IPC and Security Boundary

The renderer receives a narrow preload API. It cannot import Node modules, access the filesystem, read credential files, or call the Pi SDK directly.

The preload API exposes only:

- `getBootstrapState`
- `setProviderApiKey`
- `pickWorkspace`, `selectWorkspace`, and `listWorkspaces`
- `listSessions`, `createSession`, and `openSession`
- `sendMessage` and `cancelRun`
- `onPiEvent` and `onStateChanged`

The main process validates non-empty API-key, workspace-path, session-id, and message inputs before calling `PiRuntime`. It owns the native directory picker. IPC errors are converted to structured `{ code, message }` results; raw credential values and stack traces never cross into the renderer.

## Renderer States

1. **Provider setup:** shown whenever no Pi provider has configured auth. The user selects a supported provider and enters an API key.
2. **Workspace selection:** shown after provider setup when no workspace is selected. The user chooses a local directory through the native picker.
3. **Conversation:** a session list for the selected workspace, a transcript, a text composer, and a cancel control while a run is active.
4. **Error:** displays the structured failure in context, leaves the draft intact, and allows retry after correcting the provider, workspace, or prompt.

The initial renderer only renders text from assistant events and concise tool activity. It does not expose generic command execution controls.

## Lifecycle and Error Handling

- The shared `ModelRuntime` initializes once during main-process bootstrap.
- Missing provider auth prevents session creation and prompt submission, and directs the renderer to Provider setup.
- A missing, unreadable, or removed workspace produces a structured workspace error and leaves the existing transcript untouched.
- A prompt error produces an error event and preserves the compose draft.
- An active session is marked running until the SDK emits a settled event or the prompt rejects.
- App shutdown disposes all active sessions; persisted Pi JSONL transcripts remain available for the next launch.

## Verification

- Unit-test `PiRuntime` through a small injectable SDK facade: create/open session, text-delta forwarding, cancellation, and prompt failure shaping.
- Unit-test the workspace registry for empty, corrupted, and persisted registry cases.
- Add an Electron IPC integration test proving the renderer-visible methods do not expose filesystem or SDK objects.
- Manually verify a real API-key flow: configure a provider, choose a folder, create a session, send a prompt, observe streamed text, cancel a second prompt, restart the app, and reopen the JSONL session.

## Deferred Alignment with pi-gui

The `PiRuntime` public operations map directly to pi-gui's session-driver responsibilities but intentionally omit worktree, terminal, diff, orchestration, extension, OAuth, and catalog concerns. If those are later required, replace the internal implementation with a fuller SessionDriver-style adapter without widening the preload API or changing the renderer's business flow.
