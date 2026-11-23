import { useEffect, useMemo, useRef, useState } from "react";
import { AUDIENCES, HANDOFF_PHRASES } from "../config/audiences";
import { useConversation } from "../hooks/useConversation";
import type { WidgetConfig } from "../types";
import { Composer } from "./Composer";
import { HandoffForm, type HandoffValues } from "./HandoffForm";
import { MessageList } from "./MessageList";
import { QuickReplies } from "./QuickReplies";
import { TicketConfirmation } from "./TicketConfirmation";

type View = "chat" | "handoff" | "confirmed";

interface Props {
  config: WidgetConfig;
  onClose: () => void;
}

const wantsHuman = (text: string) => HANDOFF_PHRASES.some((p) => text.toLowerCase().includes(p));

export function ChatWindow({ config, onClose }: Props) {
  const convo = useConversation(config, AUDIENCES[config.audience].greeting);
  // Copy follows the audience the token server verified, not just the page hint.
  const settings = AUDIENCES[convo.audience];

  const [view, setView] = useState<View>("chat");
  const [ticketRef, setTicketRef] = useState<string | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);

  const hasUserMessages = useMemo(() => convo.messages.some((m) => m.role === "user"), [convo.messages]);
  const online = convo.state === "online";
  const chips = hasUserMessages ? convo.suggestions : settings.quickReplies;

  // Esc closes the window; focus moves into it on open.
  useEffect(() => {
    windowRef.current?.querySelector<HTMLElement>("textarea, button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSend = (text: string, files: File[] = []) => {
    if (!files.length && wantsHuman(text)) {
      setView("handoff");
      return;
    }
    convo.send(text, files);
  };

  const handleHandoff = async (values: HandoffValues) => {
    setSubmitting(true);
    setHandoffError(null);
    // Go back to the chat: the agent may ask a follow-up question before creating the ticket.
    setView("chat");
    try {
      const ref = await convo.requestTicket({ ...values, region: config.region, pageUrl: location.href });
      setTicketRef(ref);
      setView("confirmed");
      convo.addMessage("system", `Support request logged — reference ${ref}.`);
    } catch {
      // Never claim a ticket exists unless the agent confirmed it with a reference.
      convo.addMessage(
        "system",
        "We couldn't confirm your request was logged. Please try again, or email support@vetting.com.",
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

      {convo.state === "error" && (
        <p className="vc-error vc-banner" role="alert">
          We couldn't connect to support right now. Please try again later or email support@vetting.com.
        </p>
      )}

      {view === "chat" && (
        <>
          <MessageList messages={convo.messages} typing={convo.waitingForReply} />
          <QuickReplies options={chips} onPick={handleSend} disabled={!online} />
          {convo.handoffSuggested && (
            <div className="vc-handoff-nudge">
              <span>Would you like to contact our support team?</span>
              <button type="button" className="vc-btn vc-btn--small" onClick={() => setView("handoff")}>
                Contact support
              </button>
            </div>
          )}
          <Composer
            onSend={handleSend}
            allowAttachments={settings.allowAttachments}
            disabled={!online}
            placeholder={convo.state === "connecting" ? "Connecting…" : undefined}
          />
          <footer className="vc-footer">
            <button type="button" className="vc-link" onClick={() => setView("handoff")} disabled={!online}>
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
            convo.setHandoffSuggested(false);
            setView("chat");
          }}
        />
      )}
    </div>
  );
}
