import type { ReactNode } from 'react';
import katex from 'katex';
import { Check, Code2, Copy, Download, Eye } from 'lucide-react';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { mathFromMarkdown } from 'mdast-util-math';
import { gfm } from 'micromark-extension-gfm';
import { math } from 'micromark-extension-math';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import 'katex/dist/katex.min.css';
import './style.css';

type FormatMessage = ReturnType<typeof useIntl>['formatMessage'];

interface MarkdownNode {
  align?: Array<'center' | 'left' | 'right' | null>;
  checked?: boolean | null;
  children?: MarkdownNode[];
  depth?: number;
  lang?: string | null;
  ordered?: boolean;
  start?: number | null;
  title?: string | null;
  type: string;
  url?: string;
  value?: string;
}

export function MarkdownMessage({ children }: { children: string }) {
  const { formatMessage } = useIntl();
  const root = fromMarkdown(children, { extensions: [gfm(), math()], mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()] }) as unknown as MarkdownNode;
  return <div className="markdown-message" data-markdown-root>{renderBlocks(root.children ?? [], 'root', formatMessage)}</div>;
}

function renderBlocks(nodes: MarkdownNode[], key: string, formatMessage: FormatMessage): ReactNode[] {
  return nodes.map((node, index) => {
    const nodeKey = `${key}-${index}`;
    switch (node.type) {
      case 'paragraph': return <p className="markdown-message-paragraph" data-markdown-han-text={hasHanText(node) || undefined} key={nodeKey}>{renderInline(node.children ?? [], nodeKey)}</p>;
      case 'heading': {
        const Tag = `h${node.depth ?? 1}` as keyof React.JSX.IntrinsicElements;
        return <Tag className="markdown-message-heading" key={nodeKey}>{renderInline(node.children ?? [], nodeKey)}</Tag>;
      }
      case 'blockquote': return <blockquote className="markdown-message-blockquote" key={nodeKey}>{renderBlocks(node.children ?? [], nodeKey, formatMessage)}</blockquote>;
      case 'code': return <CodeBlock code={node.value ?? ''} formatMessage={formatMessage} key={nodeKey} language={node.lang ?? undefined} />;
      case 'math': return <MathBlock key={nodeKey} value={node.value ?? ''} />;
      case 'list': {
        const Tag = node.ordered ? 'ol' : 'ul';
        return <Tag className={`markdown-message-list ${node.ordered ? 'markdown-message-list-ordered' : 'markdown-message-list-unordered'}`} key={nodeKey} start={node.ordered ? node.start ?? 1 : undefined}>{renderBlocks(node.children ?? [], nodeKey, formatMessage)}</Tag>;
      }
      case 'listItem': return (
        <li className={`markdown-message-list-item${node.checked != null ? ' markdown-message-task-list-item' : ''}`} key={nodeKey}>
          {node.checked != null && <input aria-label={formatMessage({ id: 'markdown.task' })} checked={node.checked} disabled type="checkbox" />}
          {renderBlocks(node.children ?? [], nodeKey, formatMessage)}
        </li>
      );
      case 'thematicBreak': return <hr className="markdown-message-hr" key={nodeKey} />;
      case 'table': return <MarkdownTable formatMessage={formatMessage} key={nodeKey} node={node} nodeKey={nodeKey} />;
      default: return null;
    }
  });
}

function MarkdownTable({ formatMessage, node, nodeKey }: { formatMessage: FormatMessage; node: MarkdownNode; nodeKey: string }) {
  const tableText = tableToTsv(node);
  return (
    <div className="markdown-message-table-container" data-wide-block>
      <div className="markdown-message-table-scroller">
        <div className="markdown-message-table-wrapper">
          <table className="markdown-message-table">
            <thead>{renderTableRow(node.children?.[0], nodeKey, 'th', node.align ?? [])}</thead>
            <tbody>{(node.children ?? []).slice(1).map((row, rowIndex) => renderTableRow(row, `${nodeKey}-${rowIndex}`, 'td', node.align ?? []))}</tbody>
          </table>
        </div>
      </div>
      <div className="markdown-message-table-actions">
        <IconButton label={formatMessage({ id: 'markdown.table.copy' })} onClick={() => void navigator.clipboard?.writeText(tableText)}>
          <Copy aria-hidden="true" size={14} />
        </IconButton>
      </div>
    </div>
  );
}

function renderTableRow(row: MarkdownNode | undefined, key: string, cell: 'td' | 'th', align: MarkdownNode['align']) {
  if (row == null)
    return null;
  return (
    <tr className="markdown-message-table-row" key={key}>
      {(row.children ?? []).map((column, index) => {
        const Tag = cell;
        // mdast table cells have no stable identity beyond their column order.
        // eslint-disable-next-line react/no-array-index-key
        return <Tag className={cell === 'th' ? 'markdown-message-table-header-cell' : 'markdown-message-table-cell'} key={`${key}-${index}`} style={{ textAlign: align?.[index] }}>{renderInline(column.children ?? [], `${key}-${index}`)}</Tag>;
      })}
    </tr>
  );
}

function renderInline(nodes: MarkdownNode[], key: string): ReactNode[] {
  return nodes.map((node, index) => {
    const nodeKey = `${key}-${index}`;
    switch (node.type) {
      case 'text': return <Fragment key={nodeKey}>{node.value}</Fragment>;
      case 'emphasis': return <em key={nodeKey}>{renderInline(node.children ?? [], nodeKey)}</em>;
      case 'strong': return <strong key={nodeKey}>{renderInline(node.children ?? [], nodeKey)}</strong>;
      case 'delete': return <del key={nodeKey}>{renderInline(node.children ?? [], nodeKey)}</del>;
      case 'inlineCode': return <code className="markdown-message-inline-code" key={nodeKey}>{node.value}</code>;
      case 'inlineMath': return <MathInline key={nodeKey} value={node.value ?? ''} />;
      case 'break': return <br key={nodeKey} />;
      case 'link': return <a className="markdown-message-link" href={safeHref(node.url)} key={nodeKey} rel="noreferrer" target="_blank">{renderInline(node.children ?? [], nodeKey)}</a>;
      case 'image': return <img alt={node.title ?? ''} className="markdown-message-image" key={nodeKey} src={safeHref(node.url)} />;
      default: return null;
    }
  });
}

function CodeBlock({ code, formatMessage, language }: { code: string; formatMessage: FormatMessage; language?: string | null }) {
  const normalizedLanguage = normalizeLanguage(language);
  const displayLanguage = languageLabel(normalizedLanguage, formatMessage);
  const preview = previewLanguage(normalizedLanguage);
  const highlightKey = `${normalizedLanguage}\0${code}`;
  const [highlightedHtml, setHighlightedHtml] = useState<{ html: string; key: string }>();
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<'code' | 'preview'>('code');
  const sourceDoc = useMemo(() => previewSourceDoc(code, preview), [code, preview]);

  useEffect(() => {
    let active = true;
    void import('shiki').then(({ codeToHtml }) => codeToHtml(code, {
      lang: normalizedLanguage,
      themes: { dark: 'github-dark', light: 'github-light' },
    })).then((html) => {
      if (active)
        setHighlightedHtml({ html, key: highlightKey });
    }).catch(() => {
      // Keep the plain fallback when Shiki cannot load a language.
    });
    return () => {
      active = false;
    };
  }, [code, highlightKey, normalizedLanguage]);

  const copyCode = () => {
    void navigator.clipboard?.writeText(code);
    setCopied(true);
    window.setTimeout(setCopied, 1200, false);
  };

  return (
    <figure className="markdown-code-block" data-markdown-copy="code-block">
      <figcaption className="markdown-code-block-header">
        <span className="markdown-code-block-title">
          <Code2 aria-hidden="true" size={15} />
          {displayLanguage}
        </span>
        <span className="markdown-code-block-actions">
          {preview && (
            <IconButton label={formatMessage({ id: view === 'preview' ? 'markdown.code.show' : 'markdown.code.preview' })} onClick={() => setView(current => current === 'preview' ? 'code' : 'preview')}>
              {view === 'preview' ? <Code2 aria-hidden="true" size={14} /> : <Eye aria-hidden="true" size={14} />}
            </IconButton>
          )}
          <IconButton label={formatMessage({ id: 'markdown.code.download' })} onClick={() => downloadText(code, `code-block.${downloadExtension(normalizedLanguage)}`)}>
            <Download aria-hidden="true" size={14} />
          </IconButton>
          <IconButton label={formatMessage({ id: copied ? 'markdown.code.copied' : 'markdown.code.copy' })} onClick={copyCode}>
            {copied ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
          </IconButton>
        </span>
      </figcaption>
      {view === 'preview' && sourceDoc
        ? <iframe className="markdown-code-block-preview" sandbox="" srcDoc={sourceDoc} title={formatMessage({ id: 'markdown.code.previewTitle' }, { language: displayLanguage })} />
        : (
            <div className="markdown-code-block-body">
              {highlightedHtml?.key === highlightKey
                ? (
                    // eslint-disable-next-line react/dom-no-dangerously-set-innerhtml -- Shiki returns highlighter-owned HTML for local code text.
                    <div dangerouslySetInnerHTML={{ __html: highlightedHtml.html }} />
                  )
                : <pre><code>{code}</code></pre>}
            </div>
          )}
    </figure>
  );
}

function IconButton({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <button aria-label={label} className="markdown-message-icon-button" onClick={onClick} title={label} type="button">
      {children}
    </button>
  );
}

function MathInline({ value }: { value: string }) {
  // eslint-disable-next-line react/dom-no-dangerously-set-innerhtml -- KaTeX renders math HTML with trust disabled.
  return <span className="markdown-message-math-inline" dangerouslySetInnerHTML={{ __html: renderMath(value, false) }} />;
}

function MathBlock({ value }: { value: string }) {
  // eslint-disable-next-line react/dom-no-dangerously-set-innerhtml -- KaTeX renders math HTML with trust disabled.
  return <div className="markdown-message-math-block" dangerouslySetInnerHTML={{ __html: renderMath(value, true) }} />;
}

function renderMath(value: string, displayMode: boolean): string {
  return katex.renderToString(value, { displayMode, output: 'html', throwOnError: false, trust: false });
}

function safeHref(url: string | undefined) {
  return url != null && /^(?:https?:|mailto:|data:image\/)/i.test(url) ? url : undefined;
}

function normalizeLanguage(language: string | null | undefined): string {
  const value = language?.trim().toLowerCase();
  if (!value)
    return 'text';
  if (value === 'js')
    return 'javascript';
  if (value === 'ts')
    return 'typescript';
  if (value === 'py')
    return 'python';
  if (value === 'sh' || value === 'zsh' || value === 'bash')
    return 'shellscript';
  return value;
}

function languageLabel(language: string, formatMessage?: FormatMessage): string {
  return language === 'text' ? formatMessage?.({ id: 'markdown.code' }) ?? 'Code' : language;
}

function previewLanguage(language: string): 'html' | 'svg' | undefined {
  if (language === 'html')
    return 'html';
  if (language === 'svg' || language === 'xml')
    return 'svg';
  return undefined;
}

function previewSourceDoc(code: string, language: 'html' | 'svg' | undefined): string | undefined {
  if (language === 'html')
    return code;
  if (language === 'svg')
    return `<!doctype html><meta charset="utf-8"><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:transparent}svg{max-width:100%;height:auto}</style>${code}`;
  return undefined;
}

function downloadExtension(language: string): string {
  if (language === 'javascript')
    return 'js';
  if (language === 'typescript')
    return 'ts';
  if (language === 'python')
    return 'py';
  if (language === 'shellscript')
    return 'sh';
  return language || 'txt';
}

function downloadText(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function hasHanText(node: MarkdownNode): boolean {
  return /[\u3400-\u9FFF]/.test(nodeText(node));
}

function tableToTsv(node: MarkdownNode): string {
  return (node.children ?? []).map(row => (row.children ?? []).map(cell => nodeText(cell).replaceAll('\t', ' ')).join('\t')).join('\n');
}

function nodeText(node: MarkdownNode): string {
  if (typeof node.value === 'string')
    return node.value;
  return (node.children ?? []).map(nodeText).join('');
}
