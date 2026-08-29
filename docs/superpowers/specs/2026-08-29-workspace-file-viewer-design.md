# Workspace File Viewer Design

## Goal

Provide a read-only local workspace file viewer: a directory tree, filename filter, breadcrumb, syntax-highlighted text preview, and an action to open the selected item in the operating-system file manager.

## Scope

- Reuse the existing top-right panel control. Opening it presents the viewer; its existing expand control makes it full-width.
- Show a lazily expanded workspace tree and a case-insensitive filename filter.
- Preview UTF-8 regular files up to 1 MiB with the already-installed `shiki` highlighter.
- Let users reveal a selected file or directory with the system file manager.

Out of scope: editing, diffs, comments, file watching, binary/Office/media previews, and using Codex app-server.

## Architecture

The main process owns filesystem access. It exposes four narrow workspace IPC operations through the existing `workspaces` namespace:

1. List one directory by workspace-relative path.
2. Read one text file by workspace-relative path.
3. Search workspace-relative paths by case-insensitive filename, capped at 5,000 results.
4. Reveal one workspace-relative item in the system file manager.

Every operation resolves the selected workspace and requested item with real paths. It rejects empty, absolute, or traversing relative paths, and rejects a resolved path outside the workspace. This permits links that resolve within the workspace and blocks links that escape it. The renderer never receives arbitrary filesystem authority.

The renderer adds a private `features/workspace/file-viewer` feature mounted inside the existing right-panel shell. It keeps only UI state: selected relative path, expanded directories, and filter text. It requests children when a directory expands. While filtering, it displays the capped server results as paths; clearing the filter returns to the tree. Shiki runs only after the text response arrives; unsupported files show a compact non-preview state with the reveal action.

## Data Shapes

`WorkspaceFileEntry` contains `path`, `name`, `isDirectory`, and `isFile`. Paths are slash-separated and relative to the selected workspace.

`WorkspaceFileContent` contains `path` and `text`. The main process rejects a non-regular, non-UTF-8, or over-limit file instead of returning partial contents.

Search returns `WorkspaceFileEntry[]`; reaching the 5,000-entry ceiling marks the result as truncated so the renderer can state that it is incomplete.

## Errors

- No selected workspace: reject the operation.
- Invalid or out-of-workspace path: reject the operation.
- Missing or unreadable item: return the native read failure as an IPC rejection.
- Unsupported preview: renderer presents an unavailable state; it does not attempt a lossy decode.

## Testing

- Main-process Vitest covers relative-path validation, traversal/symlink escape rejection, sorted directory entries, UTF-8 text reads, and binary/oversized rejection using temporary directories.
- Renderer Vitest covers loading a directory, selecting a text file, the unavailable-preview state, and filter-result selection using the production preload method names.
- Run focused tests plus typecheck and relevant lint after implementation.
