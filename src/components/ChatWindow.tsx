import { useEffect, useMemo, useRef, useState } from "react";
import { GatewayClient } from "../api/client";
import { AUDIENCES, HANDOFF_PHRASES } from "../config/audiences";
import { useChatStream } from "../hooks/useChatStream";
import { useSession } from "../hooks/useSession";
import type { WidgetConfig } from "../types";
import { Composer } from "./Composer";
import { HandoffForm, type HandoffValues } from "./HandoffForm";
import { MessageList } from "./MessageList";
import { QuickReplies } from "./QuickReplies";
import { TicketConfirmation } from "./TicketConfirmation";

type View = "chat" | "handoff" | "confirmed";

interface Props {
  config: WidgetConfig;
  client: GatewayClient;
  onClose: () => void;
}

const wantsHuman = (text: string) => HANDOFF_PHRASES.some((p) => text.toLowerCase().includes(p));

export function ChatWindow({ config, client, onClose }: Props) {
  const { session, error: sessionError } = useSession(client, true);
  // Use the audience the gateway verified, falling back to the page hint for copy until it loads.
  const audience = session?.audience ?? config.audience;
  const settings = AUDIENCES[audience];

  const chat = useChatStream(client, session?.sessionId, settings.greeting);
  const [view, setView] = useState<View>("chat");
  const [ticketRef, setTicketRef] = useState<string | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);

  const hasUserMessages = useMemo(() => chat.messages.some((m) => m.role === "user"), [chat.messages]);

  // Esc closes the window; focus moves into it on open.
  useEffect(() => {
    windowRef.current?.querySelector<HTMLElement>("textarea, button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSend = (text: string) => {
    if (wantsHuman(text)) {
      setView("handoff");
      return;
    }
    void chat.send(text);
  };

  const handleHandoff = async (values: HandoffValues) => {
    if (!session) return;
    setSubmitting(true);
    setHandoffError(null);
    try {
      const { ticketRef } = await client.submitHandoff({
        sessionId: session.sessionId,
        region: config.region,
        ...values,
      });
      setTicketRef(ticketRef);
      setView("confirmed");
      chat.addSystemMessage(`Support request logged — reference ${ticketRef}.`);
    } catch {
      // Never claim a ticket exists unless the gateway confirmed it.
      setHandoffError(
        "Sorry, we couldn't log your request just now. Please try again in a moment, or email support@vetting.com.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="vc-window" role="dialog" aria-modal="false" aria-labelledby="vc-title" ref={windowRef}>
      <header className="vc-header">
        <div>
          <h2 id="vc-title">{settings.title}</h2>
          <p>{settings.subtitle}</p>
        </div>
        <button type="button" className="vc-icon-btn" onClick={onClose} aria-label="Close chat">
          ✕
        </button>
      </header>

      {sessionError && (
        <p className="vc-error vc-banner" role="alert">
          We couldn't connect to support right now. Please try again later.
        </p>
      )}

      {view === "chat" && (
        <>
          <MessageList messages={chat.messages} />
          {!hasUserMessages && (
            <QuickReplies options={settings.quickReplies} onPick={handleSend} disabled={!session} />
          )}
          {chat.handoffSuggested && (
            <div className="vc-handoff-nudge">
              <span>Would you like to contact our support team?</span>
              <button type="button" className="vc-btn vc-btn--small" onClick={() => setView("handoff")}>
                Contact support
              </button>
            </div>
          )}
          <Composer onSend={handleSend} onStop={chat.stop} streaming={chat.streaming} disabled={!session} />
          <footer className="vc-footer">
            <button type="button" className="vc-link" onClick={() => setView("handoff")}>
              Talk to a person
            </button>
            <span>AI assistant · answers may be imperfect</span>
          </footer>
        </>
      )}

      {view === "handoff" && (
        <HandoffForm
          askVisitorType={settings.askVisitorType}
          submitting={submitting}
          error={handoffError}
          onSubmit={handleHandoff}
          onCancel={() => setView("chat")}
        />
      )}

      {view === "confirmed" && ticketRef && (
        <TicketConfirmation
          ticketRef={ticketRef}
          onDone={() => {
            chat.setHandoffSuggested(false);
            setView("chat");
          }}
        />
      )}
    </div>
  );
}
