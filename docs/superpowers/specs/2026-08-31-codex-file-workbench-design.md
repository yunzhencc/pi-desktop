# Codex File Workbench Design

## Goal

Align Pi Desktop's file experience with the observable Codex Desktop flow:

1. The existing top-right tool control first opens a full-content tool launcher.
2. The launcher reproduces the Codex rows for Review, Terminal, Browser, Files, and Side chat.
3. Only Files is enabled in this phase; the other rows remain visible and disabled.
4. Files opens a dedicated, read-only file workbench instead of the current right-panel split preview.

Codex Desktop's renderer source is not public. This design follows its installed bundle behavior: workspace file tabs have a stable file identity and retain expanded paths, scroll position, search text, and selected path.

## Scope

Included:

- A dark, centered tool launcher in the application's main-content area, matching the supplied Codex reference's five-row visual hierarchy, icons, labels, and shortcut chips.
- A functional Files row and `Mod+P` shortcut.
- A dedicated file workbench with one active file, a top file tab and breadcrumb, a line-numbered read-only code view, and a full-height Explorer on the right.
- Workspace-relative file identity and preserved in-memory tree/search/selection/scroll state while switching between the launcher and Files.
- Reuse of the existing `listFiles`, `readFile`, `searchFiles`, and `revealFile` APIs and their main-process security boundary.

Excluded:

- Functional Review, Terminal, Browser, or Side chat tools.
- File editing, diffs, comments, file watching, binary/media/Office previews, multiple tabs, and Codex app-server integration.

## Navigation and State

`BasicLayout` replaces the current right-panel-only file entry with a `toolSurface` state:

- `closed`: normal conversation and settings content.
- `launcher`: the Codex-style tool launcher replaces the normal main content.
- `files`: the Files workbench replaces the normal main content.

The top-right control transitions `closed -> launcher`, `launcher -> closed`, and `files -> launcher`. Escape closes the launcher or returns from Files to the launcher. The Files shortcut transitions to `files` only when a workspace is selected.

The file workbench state belongs to the tool surface rather than a conditionally mounted right panel. It retains the selected workspace-relative path, expanded directories, search query and results, Explorer scroll offset, code scroll offsets, and rendered text while the user enters or leaves the launcher. A workspace change invalidates every pending request and resets this state before loading the new root.

## Launcher

The launcher renders five fixed rows in Codex order: Review, Terminal, Browser, Files, Side chat. Each row contains its supplied icon, localized label, and shortcut chip. Review, Terminal, Browser, and Side chat use `aria-disabled="true"`, do not receive keyboard focus, and have no action handler. Files is a normal button, has the `Mod+P` shortcut, and opens the workbench.

The launcher uses the existing app color variables and Tailwind utilities. Its content is vertically centered in the main content area, capped to the reference's wide card column, and does not introduce a separate dialog, route, or a second application shell.

## File Workbench

The workbench is a two-column full-height layout:

- The code region occupies remaining width. Its header has one file tab and a breadcrumb from the selected relative path. The code body uses Shiki only for authorized text returned by the main process. It adds a line-number gutter, preserves vertical and horizontal scroll, and presents compact unavailable and loading states.
- The Explorer is a fixed right column. It owns a filename filter and lazy directory tree. Expand/collapse is an explicit disclosure control; selecting a directory or file is separate. The selected entry receives an active style. While filtering, it shows server search results; clearing the query restores the tree. Selected files load in the code region; selected directories can be revealed but do not request a preview.

The top-right control remains available from the workbench. The current file tab's close control returns to the launcher; it does not create a multi-tab model.

## Data and Errors

No IPC or filesystem API changes are required. Renderer paths remain slash-separated and relative; the existing main process keeps path validation, symlink containment, UTF-8 and size limits, search cap, and system reveal authority.

If no workspace is selected, the Files launcher row is disabled. Directory-list, search, or preview failures remain compact in-place states. Search requests clear the previous result before making a new request and stale async completions must not update the current workspace or query view.

## Testing

- Launcher: visible on top-right control, five rows render in order, only Files is enabled, and `Mod+P` opens Files when a workspace is selected.
- Workbench: Files opens its dedicated shell, lazy expand and selection are independent, selected file shows line numbers and source, selected directory reveals, and closing returns to the launcher.
- State: switching launcher/files preserves explorer and code scroll state; switching workspace clears old state and rejects stale requests.
- Run focused renderer tests, target lint, TypeScript typecheck, and inspect a running Electron screenshot at the reference viewport before claiming visual alignment.
