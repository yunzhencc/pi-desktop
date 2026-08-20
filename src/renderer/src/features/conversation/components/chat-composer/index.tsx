import type { CSSProperties } from 'react';
import { ArrowUp, Check, ExternalLink, FileText, Folder, GitBranch, Laptop, Link, LoaderCircle, Pencil, Square, X } from 'lucide-react';
import { baseKeymap, splitBlock } from 'prosemirror-commands';
import { history } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { Schema } from 'prosemirror-model';
import { schema } from 'prosemirror-schema-basic';
import { EditorState, Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIntl } from 'react-intl';
import { ProjectPicker } from '../project-picker';

type ComposerAttachment = Awaited<ReturnType<Window['api']['composer']['addDroppedAttachments']>>['attachments'][number];
type SelectionResult = Awaited<ReturnType<Window['api']['composer']['addDroppedAttachments']>>;
type WorkspaceSnapshot = Awaited<ReturnType<Window['api']['workspaces']['get']>>;
interface LinkPopover {
  element: HTMLElement;
  href: string;
  mode: 'actions' | 'text' | 'url';
  showHrefError: boolean;
  text: string;
  value: string;
}

const composerSchema = new Schema({
  marks: schema.spec.marks.update('link', {
    ...schema.spec.marks.get('link'),
    attrs: { ...schema.spec.marks.get('link')?.attrs, autolink: { default: false }, href: { default: null, validate: 'string|null' } },
    toDOM(mark) {
      if (typeof mark.attrs.href !== 'string')
        return ['span', 0];
      return ['span', {
        'aria-expanded': 'false',
        'aria-haspopup': 'dialog',
        'class': 'composer-link',
        'data-link-href': mark.attrs.href,
        'role': 'button',
        'tabindex': '0',
      }, 0];
    },
  }),
  nodes: schema.spec.nodes,
});
const trailingUrlPunctuation = new Set(['.', ',', '!', '?', ';', ':', ']', '}']);

function validUrl(value: string) {
  let url = value;
  while (trailingUrlPunctuation.has(url.at(-1) ?? '') || (url.endsWith(')') && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)))
    url = url.slice(0, -1);
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? (parsed.hostname === 'localhost' || parsed.hostname.includes('.') || parsed.hostname.includes(':') ? url : undefined)
      : undefined;
  }
  catch {
    return undefined;
  }
}

function linkMarkRange(view: EditorView, element: HTMLElement) {
  const href = element.dataset.linkHref;
  if (!href)
    return;
  const ranges: { from: number; to: number }[] = [];
  view.state.doc.descendants((node, pos) => {
    if (!node.isText)
      return;
    const link = node.marks.find(mark => mark.type === composerSchema.marks.link && mark.attrs.href === href);
    if (!link)
      return;
    const previous = ranges.at(-1);
    if (previous && previous.to === pos)
      previous.to += node.nodeSize;
    else
      ranges.push({ from: pos, to: pos + node.nodeSize });
  });
  const index = [...view.dom.querySelectorAll<HTMLElement>('[data-link-href]')]
    .filter(candidate => candidate.dataset.linkHref === href)
    .indexOf(element);
  return ranges[index];
}

let autolinkPastedText = false;

const autolinkPlugin = new Plugin({
  props: {
    handleDOMEvents: {
      paste() {
        autolinkPastedText = true;
        return false;
      },
    },
    handleTextInput(view, from, to, text) {
      if (text !== ' ' || from !== to || view.composing)
        return false;
      const $position = view.state.doc.resolve(from);
      const previous = $position.nodeBefore;
      if ($position.parent.type.spec.code || $position.textOffset > 0 || view.state.storedMarks != null || !previous?.isText || previous.marks.some(mark => mark.type === composerSchema.marks.link))
        return false;
      const word = previous.text?.slice((previous.text.lastIndexOf(' ') ?? -1) + 1);
      const href = word == null ? undefined : validUrl(word);
      if (!href)
        return false;
      const start = from - word.length;
      view.dispatch(view.state.tr.addMark(start, start + href.length, composerSchema.marks.link.create({ href, autolink: true })).insertText(text, from, to));
      return true;
    },
  },
  appendTransaction(transactions, _oldState, state) {
    if (!autolinkPastedText || !transactions.some(transaction => transaction.docChanged))
      return null;
    autolinkPastedText = false;
    const link = state.schema.marks.link;
    const transaction = state.tr;
    state.doc.descendants((node, pos) => {
      if (!node.isText || node.text == null || node.marks.some(mark => mark.type === link && !mark.attrs.autolink))
        return;
      for (const match of node.text.matchAll(/https?:\/\/[^\s<>"'`]+/g)) {
        const href = validUrl(match[0]);
        if (href)
          transaction.addMark(pos + (match.index ?? 0), pos + (match.index ?? 0) + href.length, link.create({ href, autolink: true }));
      }
    });
    return transaction.docChanged ? transaction : null;
  },
});

export function NewConversationToolbar({ onClearProject, onCreateProject, onSelectProject, workspace }: { onClearProject?: () => void; onCreateProject?: () => void; onSelectProject?: (path: string) => void; workspace?: WorkspaceSnapshot }) {
  const [branchResult, setBranchResult] = useState<{ branch?: string; path: string }>();
  const selectedWorkspace = workspace?.workspaces.find(item => item.path === workspace.selectedWorkspacePath);

  useEffect(() => {
    if (!selectedWorkspace)
      return;
    const { path } = selectedWorkspace;
    void window.api.workspaces.getGitBranch(path).then(branch => setBranchResult({ branch, path })).catch(() => setBranchResult({ path }));
  }, [selectedWorkspace]);

  const branch = selectedWorkspace && selectedWorkspace.path === branchResult?.path ? branchResult?.branch : undefined;

  return (
    <div aria-label="新会话项目上下文" className="new-conversation-toolbar" data-has-project={Boolean(selectedWorkspace)} role="toolbar">
      {selectedWorkspace
        ? (
            <ProjectPicker
              className="new-conversation-toolbar-project new-conversation-toolbar-project-picker"
              onClearProject={onClearProject}
              onCreateProject={onCreateProject}
              onSelectProject={onSelectProject}
              triggerClassName="new-conversation-toolbar-project-trigger"
              workspace={workspace}
            >
              <Folder aria-hidden="true" className="new-conversation-toolbar-project-icon" data-project-selector-icon size={16} />
              <span>{selectedWorkspace.displayName}</span>
            </ProjectPicker>
          )
        : (
            <ProjectPicker
              className="new-conversation-toolbar-project new-conversation-toolbar-project-picker"
              onCreateProject={onCreateProject}
              onSelectProject={onSelectProject}
              triggerClassName="new-conversation-toolbar-project-trigger"
              workspace={workspace}
            >
              <Folder aria-hidden="true" size={16} />
              <span>选择项目</span>
            </ProjectPicker>
          )}
      {selectedWorkspace && (
        <>
          <span className="new-conversation-toolbar-item">
            <Laptop aria-hidden="true" size={16} />
            本地
          </span>
          {branch && (
            <span className="new-conversation-toolbar-item">
              <GitBranch aria-hidden="true" size={16} />
              {branch}
            </span>
          )}
        </>
      )}
    </div>
  );
}

export function ChatComposer({ draft, inlineEdit, isRunning = false, onStop = () => {}, onSubmitted, workspace }: {
  draft?: { id: number; text: string };
  inlineEdit?: { initialText: string; onCancel: () => void; onSubmit: (text: string) => Promise<void> | void };
  isRunning?: boolean;
  onStop?: () => void;
  onSubmitted: (text: string) => void;
  workspace?: WorkspaceSnapshot;
}) {
  const { formatMessage } = useIntl();
  const editorHostRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const linkPopoverRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef<() => void>(() => {});
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [linkPopover, setLinkPopover] = useState<LinkPopover>();
  const [linkPopoverPosition, setLinkPopoverPosition] = useState({ left: 0, top: 0 });
  const [text, setText] = useState('');
  const selectedWorkspace = workspace?.workspaces.find(item => item.path === workspace.selectedWorkspacePath);
  const initialText = inlineEdit?.initialText ?? draft?.text;
  const canSend = Boolean(inlineEdit ? text.trim() : selectedWorkspace && (text.trim() || attachments.length)) && !isSending && !isRunning;
  const placeholder = inlineEdit ? 'Edit message' : formatMessage({ id: 'composer.placeholder' });
  const editorLabel = inlineEdit ? 'Edit message' : 'Message Pi';
  const closeLinkPopover = useCallback(() => {
    if (linkPopover?.element.isConnected)
      linkPopover.element.focus();
    else
      editorViewRef.current?.focus();
    setLinkPopover(undefined);
  }, [linkPopover]);

  useEffect(() => {
    if (!editorHostRef.current)
      return;

    const view = new EditorView(editorHostRef.current, {
      attributes: {
        'aria-label': editorLabel,
        'aria-multiline': 'true',
        'role': 'textbox',
      },
      handleDOMEvents: {
        click(_view, event) {
          const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-link-href]') : null;
          const href = element?.dataset.linkHref;
          if (!element || !href)
            return false;
          event.preventDefault();
          setLinkPopover({ element, href, mode: 'actions', showHrefError: false, text: element.textContent ?? href, value: '' });
          return true;
        },
        keydown(_view, event) {
          if (event.key !== 'Enter' && event.key !== ' ')
            return false;
          const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-link-href]') : null;
          const href = element?.dataset.linkHref;
          if (!element || !href)
            return false;
          event.preventDefault();
          setLinkPopover({ element, href, mode: 'actions', showHrefError: false, text: element.textContent ?? href, value: '' });
          return true;
        },
      },
      dispatchTransaction(transaction) {
        const nextState = view.state.apply(transaction);
        view.updateState(nextState);
        const nextText = nextState.doc.textContent;
        view.dom.dataset.empty = String(!nextText);
        setText(nextText);
      },
      state: EditorState.create({
        plugins: [
          autolinkPlugin,
          history(),
          keymap({
            'Enter': () => {
              submitRef.current();
              return true;
            },
            'Mod-Enter': () => {
              submitRef.current();
              return true;
            },
            'Shift-Enter': splitBlock,
          }),
          keymap(baseKeymap),
        ],
        schema: composerSchema,
      }),
    });
    view.dom.dataset.empty = 'true';
    editorViewRef.current = view;

    return () => {
      editorViewRef.current = null;
      view.destroy();
    };
  }, [editorLabel]);

  useEffect(() => {
    if (!linkPopover)
      return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && (linkPopover.element.contains(target) || target.closest('.composer-link-popover')))
        return;
      closeLinkPopover();
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [closeLinkPopover, linkPopover]);

  useLayoutEffect(() => {
    if (!linkPopover)
      return;
    const updatePosition = () => {
      const rect = linkPopover.element.getBoundingClientRect();
      const width = linkPopoverRef.current?.offsetWidth ?? 0;
      const left = Math.min(Math.max(rect.left + rect.width / 2, 8 + width / 2), window.innerWidth - 8 - width / 2);
      setLinkPopoverPosition({ left, top: rect.top - 8 });
    };
    const frame = requestAnimationFrame(updatePosition);
    const observer = new ResizeObserver(updatePosition);
    observer.observe(linkPopover.element);
    if (linkPopoverRef.current)
      observer.observe(linkPopoverRef.current);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [linkPopover]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (initialText == null || !view)
      return;
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, initialText ? composerSchema.text(initialText) : undefined));
  }, [initialText]);

  const addSelection = useCallback((result: SelectionResult) => {
    setAttachments(current => [...current, ...result.attachments.filter(next => !current.some(existing => existing.id === next.id))]);
    setError(result.failures.map(failure => `${failure.name}: ${failure.reason}`).join('\n'));
  }, []);

  useEffect(() => {
    if (inlineEdit)
      return;
    const handlePaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented)
        return;

      const images = Array.from(event.clipboardData?.items ?? []).flatMap((item) => {
        const image = item.kind === 'file' && item.type.startsWith('image/') ? item.getAsFile() : null;
        return image ? [image] : [];
      });
      if (images.length === 0)
        return;
      if (typeof window.api.composer.addPastedImage !== 'function') {
        setError('请重启 Pi Desktop 后再粘贴图片。');
        return;
      }

      event.preventDefault();
      void Promise.all(images.map(async (image) => {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(reader.error ?? new Error('无法读取剪贴板图片。'));
          reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('无法读取剪贴板图片。'));
          reader.readAsDataURL(image);
        });
        const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
        addSelection(await window.api.composer.addPastedImage(image.name || 'pasted-image.png', data));
      })).catch(() => setError('无法读取剪贴板图片。'));
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addSelection, inlineEdit]);

  const removeAttachment = async (id: string) => {
    await window.api.composer.removeAttachment(id);
    setAttachments(current => current.filter(attachment => attachment.id !== id));
  };

  const send = async () => {
    if (!canSend)
      return;

    setError('');
    setIsSending(true);
    try {
      if (inlineEdit) {
        await inlineEdit.onSubmit(text.trim());
        return;
      }
      onSubmitted(text);
      await window.api.composer.send(text, attachments.map(attachment => attachment.id));
      editorViewRef.current?.dispatch(editorViewRef.current.state.tr.delete(0, editorViewRef.current.state.doc.content.size));
      setAttachments([]);
    }
    catch {
      setError('无法发送消息。请检查 Pi 配置后重试。');
    }
    finally {
      setIsSending(false);
    }
  };

  submitRef.current = () => {
    void send();
  };

  const saveLink = () => {
    const view = editorViewRef.current;
    if (!view || !linkPopover)
      return;
    const text = linkPopover.mode === 'text' ? linkPopover.value.trim() : linkPopover.text;
    if (!text)
      return;
    let href: string | null = linkPopover.href;
    if (linkPopover.mode === 'url') {
      const value = linkPopover.value.trim();
      if (value.length === 0) {
        href = null;
      }
      else {
        href = validUrl(value) ?? null;
        if (href == null) {
          setLinkPopover({ ...linkPopover, showHrefError: true });
          return;
        }
      }
    }
    const range = linkMarkRange(view, linkPopover.element);
    if (!range)
      return;
    const transaction = view.state.tr.insertText(text, range.from, range.to);
    transaction.removeMark(range.from, range.from + text.length, composerSchema.marks.link);
    transaction.addMark(range.from, range.from + text.length, composerSchema.marks.link.create({ href, autolink: false }));
    view.dispatch(transaction);
    closeLinkPopover();
  };

  return (
    <form
      aria-label={editorLabel}
      className={inlineEdit ? 'chat-message-user-editor' : 'chat-composer'}
      style={{ '--chat-composer-placeholder': JSON.stringify(placeholder) } as CSSProperties}
      onDragOver={inlineEdit ? undefined : event => event.preventDefault()}
      onDrop={(event) => {
        if (inlineEdit)
          return;
        event.preventDefault();
        const paths = Array.from(event.dataTransfer.files).flatMap((file) => {
          const path = (file as File & { path?: unknown }).path;
          return typeof path === 'string' ? [path] : [];
        });
        if (paths.length === 0) {
          setError('当前环境无法读取拖入文件。');
          return;
        }
        window.api.composer.addDroppedAttachments(paths).then(addSelection).catch(() => setError('无法读取拖入文件。'));
      }}
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {!inlineEdit && attachments.length > 0 && (
        <div aria-label="Attachments" className="chat-composer-attachments">
          {attachments.map(attachment => attachment.kind === 'image'
            ? (
                <div className="chat-composer-image" key={attachment.id}>
                  <img alt={attachment.name} src={attachment.previewDataUrl} />
                  <button aria-label={`Remove ${attachment.name}`} onClick={() => void removeAttachment(attachment.id)} type="button"><X aria-hidden="true" size={10} /></button>
                </div>
              )
            : (
                <div className="chat-composer-chip" key={attachment.id}>
                  <FileText aria-hidden="true" size={15} />
                  <span>{attachment.name}</span>
                  <button aria-label={`Remove ${attachment.name}`} onClick={() => void removeAttachment(attachment.id)} type="button"><X aria-hidden="true" size={14} /></button>
                </div>
              ))}
        </div>
      )}
      <div className="chat-composer-editor" ref={editorHostRef} />
      {inlineEdit
        ? (
            <div className="chat-message-user-editor-actions">
              <button aria-label="Cancel edit" disabled={isSending} onClick={inlineEdit.onCancel} type="button">取消</button>
              <button aria-label="Send edited message" disabled={!canSend} type="submit">{isSending ? <LoaderCircle aria-hidden="true" className="chat-composer-send-loading" size={16} /> : '发送'}</button>
            </div>
          )
        : (
            <div className="chat-composer-actions">
              <button
                aria-label={isRunning ? 'Stop generating' : isSending ? 'Sending message' : 'Send message'}
                className="chat-composer-send"
                disabled={isRunning ? false : !canSend}
                onClick={isRunning ? () => onStop() : undefined}
                title={isRunning ? 'Stop generating' : isSending ? 'Sending message' : 'Send message'}
                type={isRunning ? 'button' : 'submit'}
              >
                {isRunning ? <Square aria-hidden="true" fill="currentColor" size={12} /> : isSending ? <LoaderCircle aria-hidden="true" className="chat-composer-send-loading" size={16} /> : <ArrowUp aria-hidden="true" size={16} />}
              </button>
            </div>
          )}
      {error && <p aria-live="polite" className="chat-composer-error" role="status">{error}</p>}
      {linkPopover && createPortal(
        <div
          aria-label="链接选项"
          className={`composer-link-popover composer-link-popover-${linkPopover.mode === 'actions' ? 'actions' : 'editor'}`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              closeLinkPopover();
            }
          }}
          role="dialog"
          ref={linkPopoverRef}
          style={linkPopoverPosition}
        >
          {linkPopover.mode === 'actions'
            ? (
                <div className="composer-link-popover-actions-content" onMouseDown={event => event.preventDefault()}>
                  <button
                    onClick={() => {
                      window.open(linkPopover.href, '_blank', 'noopener,noreferrer');
                      closeLinkPopover();
                    }}
                    type="button"
                  >
                    <ExternalLink aria-hidden="true" size={14} />
                    打开链接
                  </button>
                  <button autoFocus onClick={() => setLinkPopover({ ...linkPopover, mode: 'text', showHrefError: false, value: linkPopover.text })} type="button">
                    <Pencil aria-hidden="true" size={14} />
                    编辑文本
                  </button>
                  <button onClick={() => setLinkPopover({ ...linkPopover, mode: 'url', showHrefError: false, value: linkPopover.href })} type="button">
                    <Link aria-hidden="true" size={14} />
                    编辑链接
                  </button>
                </div>
              )
            : (
                <form
                  className="composer-link-popover-editor-content"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    saveLink();
                  }}
                >
                  <input
                    aria-invalid={(linkPopover.mode === 'url' && linkPopover.showHrefError) || undefined}
                    aria-label={linkPopover.mode === 'text' ? '文本' : 'URL'}
                    autoFocus
                    onChange={event => setLinkPopover({ ...linkPopover, showHrefError: false, value: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.stopPropagation();
                        saveLink();
                      }
                    }}
                    type={linkPopover.mode === 'url' ? 'url' : 'text'}
                    value={linkPopover.value}
                  />
                  {linkPopover.mode === 'url' && linkPopover.showHrefError && <span className="sr-only" role="alert">请输入 HTTP 或 HTTPS 链接</span>}
                  <button aria-label={linkPopover.mode === 'text' ? '保存链接文本' : '保存链接 URL'} onClick={saveLink} type="button"><Check aria-hidden="true" size={14} /></button>
                </form>
              )}
        </div>,
        document.body,
      )}
    </form>
  );
}
