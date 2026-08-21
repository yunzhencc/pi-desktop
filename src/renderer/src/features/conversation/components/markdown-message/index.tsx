import type { ReactNode } from 'react';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import { Fragment } from 'react';
import './style.css';

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
  const root = fromMarkdown(children, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] }) as unknown as MarkdownNode;
  return <div className="markdown-message">{renderBlocks(root.children ?? [], 'root')}</div>;
}

function renderBlocks(nodes: MarkdownNode[], key: string): ReactNode[] {
  return nodes.map((node, index) => {
    const nodeKey = `${key}-${index}`;
    switch (node.type) {
      case 'paragraph': return <p key={nodeKey}>{renderInline(node.children ?? [], nodeKey)}</p>;
      case 'heading': {
        const Tag = `h${node.depth ?? 1}` as keyof React.JSX.IntrinsicElements;
        return <Tag key={nodeKey}>{renderInline(node.children ?? [], nodeKey)}</Tag>;
      }
      case 'blockquote': return <blockquote key={nodeKey}>{renderBlocks(node.children ?? [], nodeKey)}</blockquote>;
      case 'code': return <pre key={nodeKey}><code className={node.lang ? `language-${node.lang}` : undefined}>{node.value ?? ''}</code></pre>;
      case 'list': {
        const Tag = node.ordered ? 'ol' : 'ul';
        return <Tag key={nodeKey} start={node.ordered ? node.start ?? 1 : undefined}>{renderBlocks(node.children ?? [], nodeKey)}</Tag>;
      }
      case 'listItem': return (
        <li key={nodeKey}>
          {node.checked != null && <input aria-label="Task" checked={node.checked} disabled type="checkbox" />}
          {renderBlocks(node.children ?? [], nodeKey)}
        </li>
      );
      case 'thematicBreak': return <hr key={nodeKey} />;
      case 'table': return (
        <div className="markdown-message-table" key={nodeKey}>
          <table>
            <thead>{renderTableRow(node.children?.[0], nodeKey, 'th', node.align ?? [])}</thead>
            <tbody>{(node.children ?? []).slice(1).map((row, rowIndex) => renderTableRow(row, `${nodeKey}-${rowIndex}`, 'td', node.align ?? []))}</tbody>
          </table>
        </div>
      );
      default: return null;
    }
  });
}

function renderTableRow(row: MarkdownNode | undefined, key: string, cell: 'td' | 'th', align: MarkdownNode['align']) {
  if (row == null)
    return null;
  return (
    <tr key={key}>
      {(row.children ?? []).map((column, index) => {
        const Tag = cell;
        // mdast table cells have no stable identity beyond their column order.
        // eslint-disable-next-line react/no-array-index-key
        return <Tag key={`${key}-${index}`} style={{ textAlign: align?.[index] }}>{renderInline(column.children ?? [], `${key}-${index}`)}</Tag>;
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
      case 'inlineCode': return <code key={nodeKey}>{node.value}</code>;
      case 'break': return <br key={nodeKey} />;
      case 'link': return <a href={safeHref(node.url)} key={nodeKey} rel="noreferrer" target="_blank">{renderInline(node.children ?? [], nodeKey)}</a>;
      default: return null;
    }
  });
}

function safeHref(url: string | undefined) {
  return url != null && /^(?:https?:|mailto:)/i.test(url) ? url : undefined;
}
