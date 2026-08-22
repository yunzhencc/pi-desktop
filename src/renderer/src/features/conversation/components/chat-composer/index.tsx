import type { ProviderModelSnapshot, ProvidersSnapshot } from '@shared/types';
import type { CSSProperties } from 'react';
import DeepSeekIcon from '@lobehub/icons/es/DeepSeek/components/Color.js';
import OpenAIIcon from '@lobehub/icons/es/OpenAI/components/Mono.js';
import OpenCodeIcon from '@lobehub/icons/es/OpenCode/components/Mono.js';
import OpenRouterIcon from '@lobehub/icons/es/OpenRouter/components/Mono.js';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@pi-desktop/shadcn-ui/components/popover';
import Image from '@rc-component/image';
import { PrimaryScopeEnum } from '@shared/config';
import { Command } from 'cmdk';
import { ArrowUp, Bot, Check, ChevronDown, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Folder, GitBranch, Laptop, Link, LoaderCircle, Minus, Pencil, Plus, Search, Square, X } from 'lucide-react';
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
import '@rc-component/image/assets/index.css';
import './image-preview.less';
import './style.css';

type ComposerAttachment = Awaited<ReturnType<Window['piApp']['composer']['addDroppedAttachments']>>['attachments'][number];
type SelectionResult = Awaited<ReturnType<Window['piApp']['composer']['addDroppedAttachments']>>;
type WorkspaceSnapshot = Awaited<ReturnType<Window['piApp']['workspaces']['get']>>;
type ModelOption = ProviderModelSnapshot & { providerName: string };
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
const toolbarProjectClass = 'new-conversation-toolbar-project new-conversation-toolbar-project-picker relative flex min-w-0 max-w-full items-center gap-1.5 text-xs text-text-secondary [&_svg]:shrink-0 [&_span]:truncate';
const toolbarProjectTriggerClass = 'new-conversation-toolbar-project-trigger flex h-7 min-w-0 items-center gap-1.5 rounded-full border-0 bg-transparent px-3 text-left font-[inherit] text-inherit transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] hover:text-text-primary focus-visible:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] focus-visible:text-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--focus)] aria-expanded:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] aria-expanded:text-text-primary [&_svg]:shrink-0 [&_span]:truncate';
const toolbarItemClass = 'new-conversation-toolbar-item inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs text-text-secondary transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] hover:text-text-primary [&_svg]:shrink-0';

function availableModelOptions(snapshot?: ProvidersSnapshot) {
  if (!snapshot)
    return [];
  const providers = snapshot.modelPickerScope === PrimaryScopeEnum.All
    ? snapshot.connectedProviders
    : snapshot.connectedProviders.filter(provider => provider.id === snapshot.primaryProvider);
  return providers.flatMap(provider => provider.models.map(model => ({ ...model, providerName: provider.name })));
}

function selectedModelOption(models: ModelOption[], snapshot?: ProvidersSnapshot) {
  return models.find(model => model.providerId === snapshot?.defaultModel?.providerId && model.id === snapshot.defaultModel.modelId) ?? models[0];
}

function groupedModelOptions(models: ModelOption[]) {
  return models.reduce<Array<{ providerId: string; providerName: string; models: ModelOption[] }>>((groups, model) => {
    const group = groups.find(group => group.providerId === model.providerId);
    if (group)
      group.models.push(model);
    else
      groups.push({ models: [model], providerId: model.providerId, providerName: model.providerName });
    return groups;
  }, []);
}

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
    void window.piApp.workspaces.getGitBranch(path).then(branch => setBranchResult({ branch, path })).catch(() => setBranchResult({ path }));
  }, [selectedWorkspace]);

  const branch = selectedWorkspace && selectedWorkspace.path === branchResult?.path ? branchResult?.branch : undefined;

  return (
    <div aria-label="新会话项目上下文" className="new-conversation-toolbar mx-2 -mb-px flex min-h-10 items-center gap-2 rounded-t-2xl bg-surface-tertiary px-2 dark:bg-[color-mix(in_oklab,var(--foreground)_2.5%,transparent)]" data-has-project={Boolean(selectedWorkspace)} role="toolbar">
      {selectedWorkspace
        ? (
            <ProjectPicker
              className={toolbarProjectClass}
              onClearProject={onClearProject}
              onCreateProject={onCreateProject}
              onSelectProject={onSelectProject}
              triggerClassName={toolbarProjectTriggerClass}
              workspace={workspace}
            >
              <Folder aria-hidden="true" className="new-conversation-toolbar-project-icon" data-project-selector-icon size={16} />
              <span>{selectedWorkspace.displayName}</span>
            </ProjectPicker>
          )
        : (
            <ProjectPicker
              className={toolbarProjectClass}
              onCreateProject={onCreateProject}
              onSelectProject={onSelectProject}
              triggerClassName={toolbarProjectTriggerClass}
              workspace={workspace}
            >
              <Folder aria-hidden="true" size={16} />
              <span>选择项目</span>
            </ProjectPicker>
          )}
      {selectedWorkspace && (
        <>
          <span className={toolbarItemClass}>
            <Laptop aria-hidden="true" size={16} />
            本地
          </span>
          {branch && (
            <span className={toolbarItemClass}>
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
  const [providersSnapshot, setProvidersSnapshot] = useState<ProvidersSnapshot>();
  const [text, setText] = useState('');
  const selectedWorkspace = workspace?.workspaces.find(item => item.path === workspace.selectedWorkspacePath);
  const initialText = inlineEdit?.initialText ?? draft?.text;
  const canSend = Boolean(inlineEdit ? text.trim() : selectedWorkspace && (text.trim() || attachments.length)) && !isSending && !isRunning;
  const placeholder = inlineEdit ? 'Edit message' : formatMessage({ id: 'composer.placeholder' });
  const editorLabel = inlineEdit ? 'Edit message' : 'Message Pi';
  const modelOptions = availableModelOptions(providersSnapshot);
  const selectedModel = selectedModelOption(modelOptions, providersSnapshot);
  const groupModelOptions = providersSnapshot?.modelPickerScope === PrimaryScopeEnum.All && providersSnapshot.connectedProviders.length > 1;
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
    if (inlineEdit)
      return;
    if (typeof window.piApp.providers?.get !== 'function')
      return;
    window.piApp.providers.get().then(setProvidersSnapshot).catch(() => undefined);
    return typeof window.piApp.providers.onChanged === 'function'
      ? window.piApp.providers.onChanged(setProvidersSnapshot)
      : undefined;
  }, [inlineEdit]);

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
      if (typeof window.piApp.composer.addPastedImage !== 'function') {
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
        addSelection(await window.piApp.composer.addPastedImage(image.name || 'pasted-image.png', data));
      })).catch(() => setError('无法读取剪贴板图片。'));
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addSelection, inlineEdit]);

  const removeAttachment = async (id: string) => {
    await window.piApp.composer.removeAttachment(id);
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
      await window.piApp.composer.send(text, attachments.map(attachment => attachment.id));
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
      className={inlineEdit ? 'chat-message-user-editor relative flex min-h-0 w-full flex-col rounded-3xl bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)]' : 'chat-composer relative rounded-[18px] border border-border-subtle bg-surface-elevated shadow-[0_10px_28px_color-mix(in_srgb,#000_8%,transparent)]'}
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
        window.piApp.composer.addDroppedAttachments(paths).then(addSelection).catch(() => setError('无法读取拖入文件。'));
      }}
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {!inlineEdit && attachments.length > 0 && (
        <div aria-label="Attachments" className="chat-composer-attachments flex flex-wrap gap-2 px-3 pt-3">
          <Image.PreviewGroup
            icons={{ close: <X aria-hidden="true" size={18} />, next: <ChevronRight aria-hidden="true" size={20} />, prev: <ChevronLeft aria-hidden="true" size={20} /> }}
            preview={{
              actionsRender: (_, { actions, image, transform }) => (
                <div className="composer-image-preview-actions">
                  <button aria-label="Zoom out" disabled={transform.scale <= 0.1} onClick={actions.onZoomOut} type="button"><Minus aria-hidden="true" size={16} /></button>
                  <span>
                    {Math.round(transform.scale * 100)}
                    %
                  </span>
                  <button aria-label="Zoom in" disabled={transform.scale >= 4} onClick={actions.onZoomIn} type="button"><Plus aria-hidden="true" size={16} /></button>
                  <a aria-label={`Download ${image.alt}`} download={image.alt || 'image'} href={image.url}><Download aria-hidden="true" size={16} /></a>
                </div>
              ),
              maskClosable: true,
              maxScale: 4,
              minScale: 0.1,
              movable: true,
              rootClassName: 'composer-image-preview',
              scaleStep: 0.25,
              wheel: true,
            }}
          >
            {attachments.map(attachment => attachment.kind === 'image'
              ? (
                  <div className="chat-composer-image relative size-20 shrink-0 overflow-visible rounded-lg border border-[color-mix(in_srgb,var(--foreground)_20%,transparent)]" key={attachment.id}>
                    <Image alt={attachment.name} className="block size-full rounded-[7px] object-cover" rootClassName="block size-full" src={attachment.previewDataUrl} />
                    <button
                      aria-label={`Remove ${attachment.name}`}
                      className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-foreground p-0 text-background shadow-[0_1px_2px_color-mix(in_srgb,#000_28%,transparent)]"
                      onClick={(event) => {
                        event.stopPropagation();
                        void removeAttachment(attachment.id);
                      }}
                      type="button"
                    >
                      <X aria-hidden="true" size={10} />
                    </button>
                  </div>
                )
              : (
                  <div className="chat-composer-chip flex h-[30px] max-w-60 items-center gap-1.5 rounded-lg border border-border-subtle bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] py-[3px] pr-[5px] pl-[7px] text-xs text-text-secondary" key={attachment.id}>
                    <FileText aria-hidden="true" size={15} />
                    <span className="truncate">{attachment.name}</span>
                    <button aria-label={`Remove ${attachment.name}`} className="grid place-items-center rounded-lg p-0.5 text-text-tertiary hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] hover:text-foreground" onClick={() => void removeAttachment(attachment.id)} type="button"><X aria-hidden="true" size={14} /></button>
                  </div>
                ))}
          </Image.PreviewGroup>
        </div>
      )}
      <div className="chat-composer-editor mb-1 min-h-0 px-3" ref={editorHostRef} />
      {inlineEdit
        ? (
            <div className="chat-message-user-editor-actions flex justify-end gap-1.5 px-3 pb-3">
              <button aria-label="Cancel edit" className="grid h-7 min-w-0 cursor-pointer place-items-center rounded-lg border border-border-subtle bg-transparent px-3 font-[inherit] text-inherit disabled:cursor-default disabled:opacity-55" disabled={isSending} onClick={inlineEdit.onCancel} type="button">取消</button>
              <button aria-label="Send edited message" className="grid h-7 min-w-0 cursor-pointer place-items-center rounded-lg bg-foreground px-3 font-[inherit] text-surface disabled:cursor-default disabled:opacity-55" disabled={!canSend} type="submit">{isSending ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={16} /> : '发送'}</button>
            </div>
          )
        : (
            <div className="chat-composer-actions flex min-h-0 items-center justify-end gap-2 px-2 pb-2">
              {modelOptions.length > 0 && selectedModel && (
                <ModelPicker
                  models={modelOptions}
                  onSelect={async (model) => {
                    const next = await window.piApp.providers.setDefaultModel(model.providerId, model.id);
                    setProvidersSnapshot(next);
                  }}
                  showGroups={groupModelOptions}
                  selectedModel={selectedModel}
                />
              )}
              <button
                aria-label={isRunning ? 'Stop generating' : isSending ? 'Sending message' : 'Send message'}
                className="chat-composer-send grid size-7 place-items-center rounded-full bg-foreground p-0.5 text-background transition-opacity duration-150 disabled:cursor-default disabled:opacity-50"
                disabled={isRunning ? false : !canSend}
                onClick={isRunning ? () => onStop() : undefined}
                title={isRunning ? 'Stop generating' : isSending ? 'Sending message' : 'Send message'}
                type={isRunning ? 'button' : 'submit'}
              >
                {isRunning ? <Square aria-hidden="true" fill="currentColor" size={12} /> : isSending ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={16} /> : <ArrowUp aria-hidden="true" size={16} />}
              </button>
            </div>
          )}
      {error && <p aria-live="polite" className="chat-composer-error m-0 whitespace-pre-wrap px-3 pb-2.5 text-xs text-destructive" role="status">{error}</p>}
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

function ModelPicker({ models, onSelect, selectedModel, showGroups }: { models: ModelOption[]; onSelect: (model: ModelOption) => Promise<void>; selectedModel: ModelOption; showGroups: boolean }) {
  const [open, setOpen] = useState(false);
  const modelGroups = groupedModelOptions(models);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger render={<button aria-label={`选择模型，当前 ${selectedModel.name}`} className="chat-composer-model-trigger inline-flex h-7 max-w-[180px] items-center gap-[5px] rounded-full border border-border-subtle bg-transparent px-2 text-xs leading-4 text-text-secondary hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] hover:text-foreground focus-visible:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] focus-visible:text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--focus)] aria-expanded:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] aria-expanded:text-foreground [&_svg]:shrink-0 [&_span]:truncate" type="button" />}>
        <Bot aria-hidden="true" size={14} />
        <span>{selectedModel.name}</span>
        <ChevronDown aria-hidden="true" size={13} />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label="选择模型"
        className="chat-composer-model-popover max-h-[min(360px,calc(100vh_-_16px))] w-[min(280px,calc(100vw_-_16px))] overflow-hidden rounded-xl border border-border-subtle bg-surface-elevated p-1.5 shadow-[0_8px_16px_-4px_color-mix(in_srgb,#000_12%,transparent)]"
        role="dialog"
        side="top"
        sideOffset={10}
      >
        <Command className="chat-composer-model-command grid gap-1" label="搜索模型">
          <div className="chat-composer-model-search flex h-8 items-center gap-1.5 px-2 text-text-tertiary [&_input]:min-w-0 [&_input]:flex-1 [&_input]:border-0 [&_input]:bg-transparent [&_input]:font-[inherit] [&_input]:text-[13px] [&_input]:text-foreground [&_input]:outline-0 [&_input::placeholder]:text-text-tertiary">
            <Search aria-hidden="true" size={14} />
            <Command.Input aria-label="搜索模型" autoFocus placeholder="搜索模型" />
          </div>
          <Command.List className="chat-composer-model-list max-h-[calc((1lh+22px)*6)] overflow-y-auto">
            <Command.Empty className="chat-composer-model-empty p-2 text-[13px] text-text-tertiary">未找到模型</Command.Empty>
            {showGroups
              ? modelGroups.map(group => (
                  <Command.Group className="chat-composer-model-group" heading={<ProviderGroupHeading group={group} />} key={group.providerId}>
                    {group.models.map(model => <ModelPickerItem key={`${model.providerId}:${model.id}`} model={model} onSelect={onSelect} selectedModel={selectedModel} setOpen={setOpen} showProvider={false} />)}
                  </Command.Group>
                ))
              : models.map(model => <ModelPickerItem key={`${model.providerId}:${model.id}`} model={model} onSelect={onSelect} selectedModel={selectedModel} setOpen={setOpen} showProvider />)}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ProviderGroupHeading({ group }: { group: { providerId: string; providerName: string } }) {
  return (
    <span className="chat-composer-model-group-heading flex items-center gap-1.5 [&_svg]:shrink-0">
      {renderProviderGroupIcon(group.providerId)}
      <span>{group.providerName}</span>
    </span>
  );
}

function renderProviderGroupIcon(providerId: string) {
  if (providerId === 'deepseek')
    return <DeepSeekIcon aria-hidden="true" size={14} />;
  if (providerId === 'openai-codex')
    return <OpenAIIcon aria-hidden="true" size={14} />;
  if (providerId === 'openrouter')
    return <OpenRouterIcon aria-hidden="true" size={14} />;
  if (providerId === 'opencode' || providerId.startsWith('opencode-'))
    return <OpenCodeIcon aria-hidden="true" size={14} />;
  return <Bot aria-hidden="true" size={14} strokeWidth={1.75} />;
}

function ModelPickerItem({ model, onSelect, selectedModel, setOpen, showProvider }: {
  model: ModelOption;
  onSelect: (model: ModelOption) => Promise<void>;
  selectedModel: ModelOption;
  setOpen: (open: boolean) => void;
  showProvider: boolean;
}) {
  return (
    <Command.Item
      className="chat-composer-model-item flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-text-secondary data-[selected=true]:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] data-[selected=true]:text-foreground [&_small]:truncate [&_small]:text-[11px] [&_small]:text-text-tertiary [&_span]:grid [&_span]:min-w-0 [&_span]:gap-0.5 [&_strong]:truncate [&_strong]:font-medium [&_svg]:ml-auto [&_svg]:shrink-0"
      onSelect={() => {
        void onSelect(model).then(() => setOpen(false));
      }}
      value={`${model.providerName} ${model.name} ${model.id}`}
    >
      <span>
        <strong>{model.name}</strong>
        {showProvider && <small>{model.providerName}</small>}
      </span>
      {model.providerId === selectedModel.providerId && model.id === selectedModel.id && <Check aria-hidden="true" size={14} />}
    </Command.Item>
  );
}
