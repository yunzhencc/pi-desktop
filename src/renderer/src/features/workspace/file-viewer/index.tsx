import type { WorkspaceFileEntry, WorkspaceSnapshot } from '@shared/types';
import type { ReactNode } from 'react';
import { Button } from '@pi-desktop/shadcn-ui/components/button';
import { Input } from '@pi-desktop/shadcn-ui/components/input';
import { ChevronDown, ChevronRight, CircleAlert, ExternalLink, FileText, Folder, LoaderCircle, Search, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';

type FileContent = Awaited<ReturnType<Window['piApp']['workspaces']['readFile']>>;
interface ScrollOffset {
  left: number;
  top: number;
}

export function WorkspaceFileViewer({ onClose }: { onClose: () => void }) {
  const { formatMessage } = useIntl();
  const [content, setContent] = useState<FileContent>();
  const [entriesByPath, setEntriesByPath] = useState<Record<string, WorkspaceFileEntry[] | undefined>>({});
  const [expandedPaths, setExpandedPaths] = useState<ReadonlySet<string>>(() => new Set());
  const [highlightedHtml, setHighlightedHtml] = useState<string>();
  const [isReading, setIsReading] = useState(false);
  const [query, setQuery] = useState('');
  const [readError, setReadError] = useState(false);
  const [searchResult, setSearchResult] = useState<{ entries: WorkspaceFileEntry[]; truncated: boolean }>();
  const [selectedPath, setSelectedPath] = useState<string>();
  const [treeError, setTreeError] = useState(false);
  const codeScrollOffsetRef = useRef<ScrollOffset>({ left: 0, top: 0 });
  const codeScrollRef = useRef<HTMLDivElement>();
  const explorerScrollOffsetRef = useRef<ScrollOffset>({ left: 0, top: 0 });
  const explorerScrollRef = useRef<HTMLDivElement>();
  const readRequestRef = useRef(0);
  const workspacePathRef = useRef<string>();
  const workspaceVersionRef = useRef(0);

  const loadDirectory = useCallback(async (path: string, workspaceVersion = workspaceVersionRef.current) => {
    try {
      const entries = await window.piApp.workspaces.listFiles(path);
      if (workspaceVersion === workspaceVersionRef.current) {
        setEntriesByPath(current => ({ ...current, [path]: entries }));
        setTreeError(false);
      }
    }
    catch {
      if (workspaceVersion === workspaceVersionRef.current)
        setTreeError(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let receivedChange = false;
    const changeWorkspace = (path: string | undefined) => {
      if (path === workspacePathRef.current)
        return;
      workspacePathRef.current = path;
      const workspaceVersion = ++workspaceVersionRef.current;
      readRequestRef.current++;
      codeScrollOffsetRef.current = { left: 0, top: 0 };
      explorerScrollOffsetRef.current = { left: 0, top: 0 };
      setContent(undefined);
      setEntriesByPath({});
      setExpandedPaths(new Set());
      setHighlightedHtml(undefined);
      setIsReading(false);
      setQuery('');
      setReadError(false);
      setSearchResult(undefined);
      setSelectedPath(undefined);
      setTreeError(false);
      if (path)
        void loadDirectory('', workspaceVersion);
    };
    const onWorkspaceChanged = (event: Event) => {
      receivedChange = true;
      changeWorkspace((event as CustomEvent<WorkspaceSnapshot>).detail.selectedWorkspacePath);
    };
    window.addEventListener('workspace-changed', onWorkspaceChanged);
    void window.piApp.workspaces.get().then((workspace) => {
      if (active && !receivedChange)
        changeWorkspace(workspace.selectedWorkspacePath);
    }).catch(() => {
      if (active && !receivedChange)
        setTreeError(true);
    });
    return () => {
      active = false;
      window.removeEventListener('workspace-changed', onWorkspaceChanged);
    };
  }, [loadDirectory]);

  useEffect(() => {
    if (!query)
      return;

    let active = true;
    const workspaceVersion = workspaceVersionRef.current;
    void window.piApp.workspaces.searchFiles(query).then((result) => {
      if (active && workspaceVersion === workspaceVersionRef.current)
        setSearchResult(result);
    }).catch(() => {
      if (active && workspaceVersion === workspaceVersionRef.current)
        setSearchResult({ entries: [], truncated: false });
    });
    return () => {
      active = false;
    };
  }, [query]);

  useEffect(() => {
    if (!content)
      return;

    let active = true;
    const workspaceVersion = workspaceVersionRef.current;
    void import('shiki').then(({ codeToHtml }) => codeToHtml(content.text, {
      lang: languageForPath(content.path),
      themes: { dark: 'github-dark', light: 'github-light' },
    })).then((html) => {
      if (active && workspaceVersion === workspaceVersionRef.current)
        setHighlightedHtml(html);
    }).catch(() => {
      if (active && workspaceVersion === workspaceVersionRef.current)
        setHighlightedHtml(undefined);
    });
    return () => {
      active = false;
    };
  }, [content]);

  const entries = query ? searchResult?.entries : entriesByPath[''];
  const lineNumbers = content?.text.split('\n').map((_, index) => index + 1) ?? [];

  const updateQuery = (nextQuery: string) => {
    setSearchResult(undefined);
    setQuery(nextQuery);
  };

  const selectFile = async (path: string) => {
    const request = ++readRequestRef.current;
    const workspaceVersion = workspaceVersionRef.current;
    setSelectedPath(path);
    setContent(undefined);
    setHighlightedHtml(undefined);
    setReadError(false);
    setIsReading(true);
    try {
      const nextContent = await window.piApp.workspaces.readFile(path);
      if (request === readRequestRef.current && workspaceVersion === workspaceVersionRef.current)
        setContent(nextContent);
    }
    catch {
      if (request === readRequestRef.current && workspaceVersion === workspaceVersionRef.current)
        setReadError(true);
    }
    finally {
      if (request === readRequestRef.current && workspaceVersion === workspaceVersionRef.current)
        setIsReading(false);
    }
  };
  const selectDirectory = (path: string) => {
    readRequestRef.current++;
    setSelectedPath(path);
    setContent(undefined);
    setHighlightedHtml(undefined);
    setReadError(false);
    setIsReading(false);
  };
  const toggleDirectory = (path: string) => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(path))
        next.delete(path);
      else
        next.add(path);
      return next;
    });
    if (!entriesByPath[path])
      void loadDirectory(path);
  };

  const restoreCodeScroll = useCallback((element: HTMLDivElement | null) => {
    codeScrollRef.current = element ?? undefined;
    if (element) {
      element.scrollLeft = codeScrollOffsetRef.current.left;
      element.scrollTop = codeScrollOffsetRef.current.top;
    }
  }, []);
  const restoreExplorerScroll = useCallback((element: HTMLDivElement | null) => {
    explorerScrollRef.current = element ?? undefined;
    if (element) {
      element.scrollLeft = explorerScrollOffsetRef.current.left;
      element.scrollTop = explorerScrollOffsetRef.current.top;
    }
  }, []);

  useLayoutEffect(() => {
    for (const [element, offset] of [
      [codeScrollRef.current, codeScrollOffsetRef.current],
      [explorerScrollRef.current, explorerScrollOffsetRef.current],
    ] as const) {
      if (element) {
        element.scrollLeft = offset.left;
        element.scrollTop = offset.top;
      }
    }
  });

  const renderEntries = (items: WorkspaceFileEntry[] | undefined, depth = 0): ReactNode => {
    if (!items)
      return <div className="flex justify-center p-3"><LoaderCircle aria-label={formatMessage({ id: 'fileViewer.loading' })} className="size-4 animate-spin text-text-secondary" /></div>;

    return items.map((entry) => {
      const expanded = expandedPaths.has(entry.path);
      const label = query ? entry.path : entry.name;
      const paddingInlineStart = `${depth * 16 + 8}px`;
      return (
        <div key={entry.path}>
          {entry.isDirectory
            ? (
                <div className="flex items-center" style={{ paddingInlineStart }}>
                  {query
                    ? <span className="w-6 shrink-0" />
                    : (
                        <button
                          aria-expanded={expanded}
                          aria-label={formatMessage({ id: expanded ? 'fileViewer.collapse' : 'fileViewer.expand' }, { name: entry.name })}
                          className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-muted focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
                          onClick={() => toggleDirectory(entry.path)}
                          type="button"
                        >
                          {expanded ? <ChevronDown aria-hidden="true" className="size-4" /> : <ChevronRight aria-hidden="true" className="size-4" />}
                        </button>
                      )}
                  <button
                    className={`flex min-w-0 flex-1 items-center gap-1.5 rounded py-1 pe-2 text-left text-sm text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-[var(--focus)]${selectedPath === entry.path ? ' bg-muted' : ''}`}
                    onClick={() => selectDirectory(entry.path)}
                    type="button"
                  >
                    <Folder aria-hidden="true" className="size-4 shrink-0 text-text-secondary" />
                    <span className="min-w-0 truncate">{label}</span>
                  </button>
                </div>
              )
            : (
                <button
                  className={`flex w-full items-center gap-1.5 rounded py-1 pe-2 text-left text-sm text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-[var(--focus)]${selectedPath === entry.path ? ' bg-muted' : ''}`}
                  onClick={() => void selectFile(entry.path)}
                  style={{ paddingInlineStart }}
                  type="button"
                >
                  <span className="w-6 shrink-0" />
                  <FileText aria-hidden="true" className="size-4 shrink-0 text-text-secondary" />
                  <span className="min-w-0 truncate">{label}</span>
                </button>
              )}
          {entry.isDirectory && expanded && !query && renderEntries(entriesByPath[entry.path], depth + 1)}
        </div>
      );
    });
  };

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-row overflow-hidden pt-11.5" aria-label={formatMessage({ id: 'fileViewer.title' })}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-10 items-center border-b border-border text-xs text-text-secondary">
          <div className="flex min-w-0 flex-1 self-stretch" role="tablist">
            <div aria-selected="true" className="flex min-w-0 max-w-64 items-center gap-2 border-e border-b-2 border-b-foreground px-3 text-foreground" role="tab">
              <FileText aria-hidden="true" className="size-3.5 shrink-0 text-text-secondary" />
              <span className="truncate">{selectedPath?.split('/').at(-1) ?? formatMessage({ id: 'fileViewer.title' })}</span>
            </div>
          </div>
          {selectedPath && (
            <Button aria-label={formatMessage({ id: 'fileViewer.reveal' })} className="ms-auto" onClick={() => void window.piApp.workspaces.revealFile(selectedPath)} size="icon-xs" title={formatMessage({ id: 'fileViewer.reveal' })} variant="ghost">
              <ExternalLink aria-hidden="true" />
            </Button>
          )}
          <Button aria-label={formatMessage({ id: 'fileViewer.close' })} onClick={onClose} size="icon-xs" title={formatMessage({ id: 'fileViewer.close' })} variant="ghost">
            <X aria-hidden="true" />
          </Button>
        </div>
        <div
          aria-label={formatMessage({ id: 'fileViewer.header' })}
          className="min-h-0 flex-1 overflow-auto"
          onScroll={(event) => {
            codeScrollOffsetRef.current = { left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
          }}
          ref={restoreCodeScroll}
          role="region"
        >
          {isReading && (
            <p className="flex items-center gap-2 p-3 text-sm text-text-secondary">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              {formatMessage({ id: 'fileViewer.loading' })}
            </p>
          )}
          {readError && (
            <p className="flex items-center gap-2 p-3 text-sm text-text-secondary">
              <CircleAlert aria-hidden="true" className="size-4" />
              {formatMessage({ id: 'fileViewer.unavailable' })}
            </p>
          )}
          {!content && !isReading && !readError && <p className="p-3 text-sm text-text-secondary">{formatMessage({ id: 'fileViewer.empty' })}</p>}
          {content && (
            <div className="flex min-h-full min-w-max">
              <div aria-hidden="true" className="select-none border-e border-border px-3 py-3 text-right font-mono text-xs leading-5 text-text-secondary">
                {lineNumbers.map(number => <div key={number}>{number}</div>)}
              </div>
              {highlightedHtml
                ? (
                    // eslint-disable-next-line react/dom-no-dangerously-set-innerhtml -- Shiki escapes the authorized plain-text response.
                    <div className="min-w-0 flex-1 text-xs leading-5 [&_pre]:m-0 [&_pre]:min-h-full [&_pre]:overflow-visible [&_pre]:p-3 [&_pre]:text-xs [&_pre]:leading-5" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
                  )
                : <pre className="m-0 min-h-full p-3 text-xs leading-5"><code>{content.text}</code></pre>}
            </div>
          )}
        </div>
      </div>
      <aside className="flex h-full w-64 shrink-0 flex-col border-l border-border" aria-label={formatMessage({ id: 'fileViewer.explorer' })}>
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
            <Input aria-label={formatMessage({ id: 'fileViewer.search' })} className="ps-8" onChange={event => updateQuery(event.target.value)} type="search" value={query} />
          </div>
        </div>
        <div
          aria-label={formatMessage({ id: 'fileViewer.explorer' })}
          className="min-h-0 flex-1 overflow-auto"
          onScroll={(event) => {
            explorerScrollOffsetRef.current = { left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
          }}
          ref={restoreExplorerScroll}
          role="region"
        >
          {query && searchResult?.truncated && <p className="px-3 py-2 text-xs text-text-secondary">{formatMessage({ id: 'fileViewer.search.truncated' })}</p>}
          {treeError
            ? (
                <p className="flex items-center gap-2 px-3 py-2 text-sm text-destructive">
                  <CircleAlert aria-hidden="true" className="size-4" />
                  {formatMessage({ id: 'fileViewer.tree.error' })}
                </p>
              )
            : renderEntries(entries)}
        </div>
      </aside>
    </section>
  );
}

function languageForPath(path: string): string {
  const extension = path.split('.').at(-1)?.toLowerCase();
  return ({ cjs: 'js', jsx: 'jsx', md: 'markdown', mts: 'ts', mjs: 'js', tsx: 'tsx', yml: 'yaml' }[extension ?? ''] ?? extension ?? 'text');
}
