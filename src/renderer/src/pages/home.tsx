import { useEffect, useState } from 'react';
import { ChatComposer } from '../components/chat-composer';

interface Message {
  id: number;
  role: 'assistant' | 'error' | 'user';
  text: string;
  done?: boolean;
}

export function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => window.api.composer.onUpdate((update) => {
    setMessages((current) => {
      if (update.type === 'error')
        return [...current, { id: Date.now(), role: 'error', text: update.text }];

      const last = current.at(-1);
      const message = { done: update.done, id: last?.role === 'assistant' ? last.id : Date.now(), role: 'assistant' as const, text: update.text };
      return last?.role === 'assistant' && !last.done ? [...current.slice(0, -1), message] : [...current, message];
    });
  }), []);

  return (
    <section className="chat-page">
      <div aria-live="polite" className="chat-transcript">
        {messages.length === 0
          ? (
              <div className="chat-empty-state">
                <p>What can I help you build?</p>
                <span>Describe a task, paste code, or add an image or text file.</span>
              </div>
            )
          : messages.map(message => <article className={`chat-message chat-message-${message.role}`} key={message.id}>{message.text}</article>)}
      </div>
      <div className="chat-composer-wrap">
        <ChatComposer onSubmitted={text => setMessages(current => [...current, { id: Date.now(), role: 'user', text }])} />
      </div>
    </section>
  );
}
