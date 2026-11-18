import { useCallback, useRef, useState } from "react";
import type { GatewayClient } from "../api/client";
import type { ChatMessage } from "../types";

const uid = () => Math.random().toString(36).slice(2, 10);

export function useChatStream(client: GatewayClient, sessionId: string | undefined, greeting: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "greeting", role: "assistant", text: greeting },
  ]);
  const [streaming, setStreaming] = useState(false);
  const [handoffSuggested, setHandoffSuggested] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const addSystemMessage = useCallback((text: string) => {
    setMessages((m) => [...m, { id: uid(), role: "system", text }]);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !sessionId || streaming) return;

      const replyId = uid();
      setMessages((m) => [
        ...m,
        { id: uid(), role: "user", text: trimmed },
        { id: replyId, role: "assistant", text: "", pending: true },
      ]);
      setStreaming(true);

      const patchReply = (fn: (msg: ChatMessage) => ChatMessage) =>
        setMessages((m) => m.map((msg) => (msg.id === replyId ? fn(msg) : msg)));

      abortRef.current = new AbortController();
      try {
        await client.streamChat(
          sessionId,
          trimmed,
          (event) => {
            switch (event.type) {
              case "token":
                patchReply((msg) => ({ ...msg, text: msg.text + event.text }));
                break;
              case "handoff_suggested":
                setHandoffSuggested(true);
                break;
              case "error":
                patchReply((msg) => ({ ...msg, text: msg.text || event.message, pending: false }));
                break;
              case "done":
                patchReply((msg) => ({ ...msg, pending: false }));
                break;
            }
          },
          abortRef.current.signal,
        );
      } catch {
        patchReply((msg) => ({
          ...msg,
          pending: false,
          text: msg.text || "Sorry, I couldn't reach the support service. Please try again or ask to talk to a person.",
        }));
      } finally {
        patchReply((msg) => ({ ...msg, pending: false }));
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [client, sessionId, streaming],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { messages, send, stop, streaming, handoffSuggested, setHandoffSuggested, addSystemMessage };
}
