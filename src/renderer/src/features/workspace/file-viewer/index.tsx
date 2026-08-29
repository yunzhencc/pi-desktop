import type { WorkspaceFileEntry } from '@shared/types';
import type { ReactNode } from 'react';
import { Button } from '@pi-desktop/shadcn-ui/components/button';
import { Input } from '@pi-desktop/shadcn-ui/components/input';
import { ScrollArea } from '@pi-desktop/shadcn-ui/components/scroll-area';
import { ChevronDown, ChevronRight, CircleAlert, ExternalLink, FileText, Folder, LoaderCircle, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';

type FileContent = Awaited<ReturnType<Window['piApp']['workspaces']['readFile']>>;

export function WorkspaceFileViewer() {
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
  const readRequestRef = useRef(0);

  const loadDirectory = useCallback(async (path: string) => {
    try {
      const entries = await window.piApp.workspaces.listFiles(path);
      setEntriesByPath(current => ({ ...current, [path]: entries }));
      setTreeError(false);
    }
    catch {
      setTreeError(true);
    }
  }, []);

  useEffect(() => {
    void loadDirectory('');
  }, [loadDirectory]);

  useEffect(() => {
    if (!query)
      return;

    let active = true;
    void window.piApp.workspaces.searchFiles(query).then((result) => {
      if (active)
        setSearchResult(result);
    }).catch(() => {
      if (active)
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
    void import('shiki').then(({ codeToHtml }) => codeToHtml(content.text, {
      lang: languageForPath(content.path),
      themes: { dark: 'github-dark', light: 'github-light' },
    })).then((html) => {
      if (active)
        setHighlightedHtml(html);
    }).catch(() => {
      if (active)
        setHighlightedHtml(undefined);
    });
    return () => {
      active = false;
    };
  }, [content]);

  const breadcrumbs = useMemo(() => selectedPath?.split('/').filter(Boolean).map((label, index, parts) => ({
    label,
    path: parts.slice(0, index + 1).join('/'),
  })) ?? [], [selectedPath]);
  const entries = query ? searchResult?.entries : entriesByPath[''];

  const selectFile = async (path: string) => {
    const request = ++readRequestRef.current;
    setSelectedPath(path);
    setContent(undefined);
    setHighlightedHtml(undefined);
    setReadError(false);
    setIsReading(true);
    try {
      const nextContent = await window.piApp.workspaces.readFile(path);
      if (request === readRequestRef.current)
        setContent(nextContent);
    }
    catch {
      if (request === readRequestRef.current)
        setReadError(true);
    }
    finally {
      if (request === readRequestRef.current)
        setIsReading(false);
    }
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

  const renderEntries = (items: WorkspaceFileEntry[] | undefined, depth = 0): ReactNode => {
    if (!items)
      return <div className="flex justify-center p-3"><LoaderCircle aria-label={formatMessage({ id: 'fileViewer.loading' })} className="size-4 animate-spin text-text-secondary" /></div>;

    return items.map((entry) => {
      const expanded = expandedPaths.has(entry.path);
      const label = query ? entry.path : entry.name;
      return (
        <div key={entry.path}>
          <button
            aria-expanded={entry.isDirectory ? expanded : undefined}
            className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
            onClick={() => entry.isDirectory ? toggleDirectory(entry.path) : void selectFile(entry.path)}
            style={{ paddingInlineStart: `${depth * 16 + 8}px` }}
            type="button"
          >
            {entry.isDirectory
              ? expanded ? <ChevronDown aria-hidden="true" className="size-4 shrink-0" /> : <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
              : <span className="w-4 shrink-0" />}
            {entry.isDirectory ? <Folder aria-hidden="true" className="size-4 shrink-0 text-text-secondary" /> : <FileText aria-hidden="true" className="size-4 shrink-0 text-text-secondary" />}
            <span className="min-w-0 truncate">{label}</span>
          </button>
          {entry.isDirectory && expanded && !query && renderEntries(entriesByPath[entry.path], depth + 1)}
        </div>
      );
    });
  };

  return (
    <section className="flex h-full min-w-0 flex-col pt-11.5" aria-label={formatMessage({ id: 'fileViewer.title' })}>
      <div className="border-b border-border px-3 py-2">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <FileText aria-hidden="true" className="size-4" />
          {formatMessage({ id: 'fileViewer.title' })}
        </div>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
          <Input aria-label={formatMessage({ id: 'fileViewer.search' })} className="ps-8" onChange={event => setQuery(event.target.value)} type="search" value={query} />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(8rem,1fr)_minmax(12rem,2fr)]">
        <ScrollArea className="border-b border-border">
          {query && searchResult?.truncated && <p className="px-3 py-2 text-xs text-text-secondary">{formatMessage({ id: 'fileViewer.search.truncated' })}</p>}
          {treeError
            ? (
                <p className="flex items-center gap-2 px-3 py-2 text-sm text-destructive">
                  <CircleAlert aria-hidden="true" className="size-4" />
                  {formatMessage({ id: 'fileViewer.tree.error' })}
                </p>
              )
            : renderEntries(entries)}
        </ScrollArea>
        <div className="flex min-h-0 flex-col">
          <div className="flex min-h-10 items-center gap-1 border-b border-border px-3 text-xs text-text-secondary">
            <span>{formatMessage({ id: 'fileViewer.root' })}</span>
            {breadcrumbs.map(breadcrumb => (
              <span className="flex items-center gap-1" key={breadcrumb.path}>
                <ChevronRight aria-hidden="true" className="size-3" />
                {breadcrumb.label}
              </span>
            ))}
            {selectedPath && (
              <Button aria-label={formatMessage({ id: 'fileViewer.reveal' })} className="ms-auto" onClick={() => void window.piApp.workspaces.revealFile(selectedPath)} size="icon-xs" title={formatMessage({ id: 'fileViewer.reveal' })} variant="ghost">
                <ExternalLink aria-hidden="true" />
              </Button>
            )}
          </div>
          <ScrollArea className="min-h-0 flex-1">
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
            {content && (highlightedHtml
              ? (
                  // eslint-disable-next-line react/dom-no-dangerously-set-innerhtml -- Shiki escapes the authorized plain-text response.
                  <div className="[&_pre]:m-0 [&_pre]:min-h-full [&_pre]:overflow-auto [&_pre]:p-3 [&_pre]:text-xs" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
                )
              : <pre className="m-0 min-h-full overflow-auto p-3 text-xs"><code>{content.text}</code></pre>)}
          </ScrollArea>
        </div>
      </div>
    </section>
  );
}

function languageForPath(path: string): string {
  const extension = path.split('.').at(-1)?.toLowerCase();
  return ({ cjs: 'js', jsx: 'jsx', md: 'markdown', mts: 'ts', mjs: 'js', tsx: 'tsx', yml: 'yaml' }[extension ?? ''] ?? extension ?? 'text');
}
