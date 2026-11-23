import { useEffect, useRef } from "react";
import type { ChatMessage } from "../types";
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
          {m.role === "assistant" ? <RichText text={m.text} /> : m.text}
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
