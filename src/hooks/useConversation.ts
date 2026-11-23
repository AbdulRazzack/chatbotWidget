import { ConnectionStatus, DirectLine } from "botframework-directlinejs";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDirectLineToken } from "../api/tokenClient";
import { EVENTS, type Audience, type ChatMessage, type HandoffRequest, type WidgetConfig } from "../types";

const uid = () => Math.random().toString(36).slice(2, 10);
const REPLY_TIMEOUT_MS = 30_000;
const TICKET_TIMEOUT_MS = 45_000;

export type ConnectionState = "connecting" | "online" | "error";

/** Minimal shape of the Bot Framework activities we care about. */
interface IncomingActivity {
  type: string;
  id?: string;
  from?: { id?: string; role?: string };
  text?: string;
  name?: string;
  value?: unknown;
  attachments?: { contentType?: string; content?: unknown }[];
  suggestedActions?: { actions?: { title?: string; value?: unknown }[] };
}

/** Pulls readable text out of Adaptive Cards so card-only replies still show something. */
function textFromAttachments(attachments: IncomingActivity["attachments"]): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "TextBlock" && typeof n.text === "string") out.push(n.text);
    for (const v of Object.values(n)) if (typeof v === "object") walk(v);
  };
  for (const a of attachments ?? []) {
    if (a.contentType === "application/vnd.microsoft.card.adaptive") walk(a.content);
  }
  return out.join("\n");
}

interface PendingTicket {
  resolve: (ticketRef: string) => void;
  reject: (err: Error) => void;
  timer: number;
}

/**
 * One Direct Line conversation with the Copilot Studio front agent chosen by the token server.
 * Copilot Studio doesn't stream over Direct Line, so we show a typing indicator until the reply arrives.
 */
export function useConversation(config: WidgetConfig, greeting: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: "greeting", role: "assistant", text: greeting }]);
  const [state, setState] = useState<ConnectionState>("connecting");
  const [audience, setAudience] = useState<Audience>(config.audience);
  const [waitingForReply, setWaitingForReply] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [handoffSuggested, setHandoffSuggested] = useState(false);

  const dlRef = useRef<DirectLine | null>(null);
  const userIdRef = useRef<string>("");
  const pendingTicketRef = useRef<PendingTicket | null>(null);
  const replyTimerRef = useRef<number | undefined>(undefined);

  const addMessage = useCallback((role: ChatMessage["role"], text: string) => {
    setMessages((m) => [...m, { id: uid(), role, text }]);
  }, []);

  const stopWaiting = () => {
    window.clearTimeout(replyTimerRef.current);
    setWaitingForReply(false);
  };

  useEffect(() => {
    let cancelled = false;
    let startSent = false;
    let typingTimer: number | undefined;
    const subs: { unsubscribe(): void }[] = [];

    const handleActivity = (a: IncomingActivity) => {
      // Our own messages are echoed back by Direct Line; we already rendered them.
      if (a.from?.id === userIdRef.current) return;

      if (a.type === "typing") {
        setWaitingForReply(true);
        // Clear a stray typing indicator if no message follows.
        window.clearTimeout(typingTimer);
        typingTimer = window.setTimeout(() => setWaitingForReply(false), 20_000);
        return;
      }

      if (a.type === "event") {
        window.clearTimeout(typingTimer);
        setWaitingForReply(false);
        const value = (a.value ?? {}) as Record<string, unknown>;
        if (a.name === EVENTS.ticketCreated && typeof value.ticketRef === "string") {
          pendingTicketRef.current?.resolve(value.ticketRef);
        } else if (a.name === EVENTS.ticketFailed) {
          pendingTicketRef.current?.reject(new Error(String(value.message ?? "Ticket creation failed")));
        } else if (a.name === EVENTS.handoffSuggested) {
          setHandoffSuggested(true);
        }
        return;
      }

      if (a.type === "message") {
        const text = [a.text, textFromAttachments(a.attachments)].filter(Boolean).join("\n").trim();
        if (text) addMessage("assistant", text);
        window.clearTimeout(typingTimer);
        setSuggestions(
          (a.suggestedActions?.actions ?? [])
            .map((x) => String(x.value ?? x.title ?? ""))
            .filter(Boolean),
        );
        stopWaiting();
      }
    };

    (async () => {
      try {
        const t = await fetchDirectLineToken(config);
        if (cancelled) return;
        userIdRef.current = t.userId;
        setAudience(t.audience);

        // The DirectLine client refreshes the token automatically while the conversation is open.
        const dl = new DirectLine({ token: t.token, domain: t.domain, webSocket: t.webSocket });
        dlRef.current = dl;

        subs.push(
          dl.connectionStatus$.subscribe((status) => {
            if (status === ConnectionStatus.Online) {
              setState("online");
              if (!startSent) {
                startSent = true;
                // Gives each front agent its context. The agent's Conversation Start topic handles it.
                dl.postActivity({
                  type: "event",
                  name: EVENTS.startConversation,
                  from: { id: t.userId },
                  value: { audience: t.audience, region: config.region, pageUrl: location.href },
                } as never).subscribe({ error: () => undefined });
              }
            } else if (
              status === ConnectionStatus.FailedToConnect ||
              status === ConnectionStatus.ExpiredToken ||
              status === ConnectionStatus.Ended
            ) {
              setState("error");
            }
          }),
          dl.activity$.subscribe((a) => handleActivity(a as unknown as IncomingActivity)),
        );
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      subs.forEach((s) => s.unsubscribe());
      dlRef.current?.end();
      dlRef.current = null;
      window.clearTimeout(replyTimerRef.current);
      window.clearTimeout(typingTimer);
      pendingTicketRef.current?.reject(new Error("Conversation closed"));
    };
    // Re-connect only if who/where the widget is changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.tokenUrl, config.authToken, config.audience, config.region, addMessage]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      const dl = dlRef.current;
      if (!trimmed || !dl || state !== "online") return;

      addMessage("user", trimmed);
      setSuggestions([]);
      setWaitingForReply(true);
      window.clearTimeout(replyTimerRef.current);
      replyTimerRef.current = window.setTimeout(() => {
        setWaitingForReply(false);
        addMessage("system", "This is taking longer than usual. You can keep waiting or contact our support team.");
      }, REPLY_TIMEOUT_MS);

      dl.postActivity({
        type: "message",
        from: { id: userIdRef.current },
        text: trimmed,
        locale: navigator.language,
      } as never).subscribe({
        error: () => {
          stopWaiting();
          addMessage("system", "Your message couldn't be sent. Please check your connection and try again.");
        },
      });
    },
    [addMessage, state],
  );

  /**
   * Sends the handoff form to the front agent, which passes it to the Ticketing Agent.
   * Resolves only when the agent sends back `ticketCreated` with a real reference.
   */
  const requestTicket = useCallback((req: HandoffRequest): Promise<string> => {
    const dl = dlRef.current;
    if (!dl) return Promise.reject(new Error("Not connected"));

    pendingTicketRef.current?.reject(new Error("Superseded"));
    return new Promise<string>((resolve, reject) => {
      const done = () => {
        window.clearTimeout(pending.timer);
        if (pendingTicketRef.current === pending) pendingTicketRef.current = null;
      };
      const pending: PendingTicket = {
        resolve: (ref) => {
          done();
          resolve(ref);
        },
        reject: (err) => {
          done();
          reject(err);
        },
        timer: window.setTimeout(() => pending.reject(new Error("Timed out waiting for ticket")), TICKET_TIMEOUT_MS),
      };
      pendingTicketRef.current = pending;

      dl.postActivity({
        type: "event",
        name: EVENTS.handoffRequest,
        from: { id: userIdRef.current },
        value: req,
      } as never).subscribe({ error: () => pending.reject(new Error("Could not send request")) });
    });
  }, []);

  return {
    messages,
    state,
    audience,
    waitingForReply,
    suggestions,
    handoffSuggested,
    setHandoffSuggested,
    send,
    requestTicket,
    addMessage,
  };
}
