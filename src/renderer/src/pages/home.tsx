import type { CSSProperties } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChatComposer } from '../components/chat-composer';
import { MarkdownMessage } from '../components/markdown-message';
import { ThreadScrollLayout } from '../components/thread-scroll-layout';

interface Message {
  completedAtMs?: number;
  id: number;
  role: 'assistant' | 'error' | 'user';
  startedAtMs?: number;
  text: string;
  done?: boolean;
}

export function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const composerFooterRef = useRef<HTMLDivElement>(null);
  const [composerFooterHeightPx, setComposerFooterHeightPx] = useState(0);

  useLayoutEffect(() => {
    const footer = composerFooterRef.current;
    if (footer == null)
      return;

    const updateHeight = () => setComposerFooterHeightPx(footer.offsetHeight);
    const frame = requestAnimationFrame(updateHeight);
    if (typeof ResizeObserver === 'undefined')
      return () => cancelAnimationFrame(frame);

    const observer = new ResizeObserver(updateHeight);
    observer.observe(footer);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => window.api.composer.onUpdate((update) => {
    setMessages((current) => {
      if (update.type === 'error')
        return [...current, { id: Date.now(), role: 'error', text: update.text }];

      const last = current.at(-1);
      const now = Date.now();
      const startedAtMs = last?.role === 'assistant'
        ? last.startedAtMs
        : current.findLast(message => message.role === 'user')?.startedAtMs ?? now;
      const message = { completedAtMs: update.done ? now : undefined, done: update.done, id: last?.role === 'assistant' ? last.id : now, role: 'assistant' as const, startedAtMs, text: update.text };
      return last?.role === 'assistant' && !last.done ? [...current.slice(0, -1), message] : [...current, message];
    });
  }), []);

  return (
    <section className="chat-page" style={{ '--thread-scroll-padding-bottom': `${composerFooterHeightPx + 16}px` } as CSSProperties}>
      {messages.length === 0
        ? (
            <div className="chat-empty-state">
              <p>What can I help you build?</p>
              <span>Describe a task, paste code, or add an image or text file.</span>
            </div>
          )
        : (
            <ThreadScrollLayout turns={messages.map(message => ({ key: String(message.id), message }))}>
              {({ message }) => (
                <article className={`chat-message chat-message-${message.role}`}>
                  {message.role === 'assistant'
                    ? (
                        <>
                          <WorkedFor completedAtMs={message.completedAtMs} startedAtMs={message.startedAtMs} />
                          <MarkdownMessage>{message.text}</MarkdownMessage>
                        </>
                      )
                    : message.text}
                </article>
              )}
            </ThreadScrollLayout>
          )}
      <div className="chat-composer-footer" ref={composerFooterRef}>
        <div className="chat-composer-wrap">
          <ChatComposer onSubmitted={(text) => {
            const startedAtMs = Date.now();
            setMessages(current => [...current, { id: startedAtMs, role: 'user', startedAtMs, text }]);
          }}
          />
        </div>
      </div>
    </section>
  );
}

function WorkedFor({ completedAtMs, startedAtMs }: Pick<Message, 'completedAtMs' | 'startedAtMs'>) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAtMs == null || completedAtMs != null)
      return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [completedAtMs, startedAtMs]);

  if (startedAtMs == null)
    return null;
  const elapsedMs = Math.max(0, (completedAtMs ?? now) - startedAtMs);
  const label = completedAtMs != null ? 'Worked for' : elapsedMs >= 1000 ? 'Working for' : 'Working';
  return <p className="chat-worked-for">{label === 'Working' ? label : `${label} ${formatDuration(elapsedMs)}`}</p>;
}

function formatDuration(durationMs: number) {
  const seconds = Math.floor(durationMs / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
