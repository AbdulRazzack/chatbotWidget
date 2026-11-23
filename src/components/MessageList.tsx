import { useEffect, useRef } from "react";
import type { ChatAttachment, ChatMessage } from "../types";
import { RichText } from "./RichText";

export function MessageList({ messages, typing }: { messages: ChatMessage[]; typing: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, typing]);

  return (
    <div className="vc-messages" role="log" aria-live="polite" aria-relevant="additions text">
      {messages.map((m) => (
        <div key={m.id} className={`vc-msg vc-msg--${m.role}`}>
          {m.role === "assistant" && <span className="vc-sr-only">Support assistant: </span>}
          {m.role === "user" && <span className="vc-sr-only">You: </span>}
          {m.attachments?.length ? <Attachments items={m.attachments} /> : null}
          {m.text && (m.role === "assistant" ? <RichText text={m.text} /> : m.text)}
        </div>
      ))}
      {typing && (
        <div className="vc-msg vc-msg--assistant">
          <span className="vc-typing" role="status" aria-label="Assistant is typing">
            <span />
            <span />
            <span />
          </span>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

function Attachments({ items }: { items: ChatAttachment[] }) {
  return (
    <div className="vc-msg-files">
      {items.map((a, i) =>
        a.contentType.startsWith("image/") ? (
          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="vc-msg-image" title={a.name}>
            <img src={a.url} alt={a.name} />
          </a>
        ) : (
          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="vc-msg-file">
            📎 {a.name}
          </a>
        ),
      )}
    </div>
  );
}
