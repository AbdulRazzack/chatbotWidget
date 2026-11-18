import { useEffect, useRef } from "react";
import type { ChatMessage } from "../types";

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  return (
    <div className="vc-messages" role="log" aria-live="polite" aria-relevant="additions text">
      {messages.map((m) => (
        <div key={m.id} className={`vc-msg vc-msg--${m.role}`}>
          {m.role === "assistant" && <span className="vc-sr-only">Support assistant: </span>}
          {m.role === "user" && <span className="vc-sr-only">You: </span>}
          {m.text}
          {m.pending && !m.text && (
            <span className="vc-typing" aria-label="Assistant is typing">
              <span />
              <span />
              <span />
            </span>
          )}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
