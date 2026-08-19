import type { CSSProperties } from 'react';
import { ArrowUp, FileText, X } from 'lucide-react';
import { baseKeymap } from 'prosemirror-commands';
import { history } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { schema } from 'prosemirror-schema-basic';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';

type ComposerAttachment = Awaited<ReturnType<Window['api']['composer']['addDroppedAttachments']>>['attachments'][number];
type SelectionResult = Awaited<ReturnType<Window['api']['composer']['addDroppedAttachments']>>;

export function ChatComposer({ onSubmitted }: { onSubmitted: (text: string) => void }) {
  const { formatMessage } = useIntl();
  const editorHostRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const submitRef = useRef<() => void>(() => {});
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [text, setText] = useState('');
  const canSend = Boolean(text.trim() || attachments.length) && !isSending;
  const placeholder = formatMessage({ id: 'composer.placeholder' });

  useEffect(() => {
    if (!editorHostRef.current)
      return;

    const view = new EditorView(editorHostRef.current, {
      attributes: {
        'aria-label': 'Message Pi',
        'aria-multiline': 'true',
        'role': 'textbox',
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
          history(),
          keymap({
            'Mod-Enter': () => {
              submitRef.current();
              return true;
            },
          }),
          keymap(baseKeymap),
        ],
        schema,
      }),
    });
    view.dom.dataset.empty = 'true';
    editorViewRef.current = view;

    return () => {
      editorViewRef.current = null;
      view.destroy();
    };
  }, []);

  const addSelection = useCallback((result: SelectionResult) => {
    setAttachments(current => [...current, ...result.attachments.filter(next => !current.some(existing => existing.id === next.id))]);
    setError(result.failures.map(failure => `${failure.name}: ${failure.reason}`).join('\n'));
  }, []);

  useEffect(() => {
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
  }, [addSelection]);

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
      await window.api.composer.send(text, attachments.map(attachment => attachment.id));
      onSubmitted(text);
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

  return (
    <form
      aria-label="Message Pi"
      className="chat-composer"
      style={{ '--chat-composer-placeholder': JSON.stringify(placeholder) } as CSSProperties}
      onDragOver={event => event.preventDefault()}
      onDrop={(event) => {
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
      {attachments.length > 0 && (
        <div aria-label="Attachments" className="chat-composer-attachments">
          {attachments.map(attachment => (
            <div className="chat-composer-chip" key={attachment.id}>
              {attachment.kind === 'image'
                ? <img alt="" className="chat-composer-chip-image" src={attachment.previewDataUrl} />
                : <FileText aria-hidden="true" size={15} />}
              <span>{attachment.name}</span>
              <button aria-label={`Remove ${attachment.name}`} onClick={() => void removeAttachment(attachment.id)} type="button"><X aria-hidden="true" size={14} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="chat-composer-editor" ref={editorHostRef} />
      <div className="chat-composer-actions">
        <button aria-label="Send message" className="chat-composer-send" disabled={!canSend} title="Send message" type="submit"><ArrowUp aria-hidden="true" size={16} /></button>
      </div>
      {error && <p aria-live="polite" className="chat-composer-error" role="status">{error}</p>}
    </form>
  );
}
