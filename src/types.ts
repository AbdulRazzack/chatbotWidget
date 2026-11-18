export type Audience = "public" | "client" | "candidate";
export type Region = "UK" | "AU";

/** Options a host page passes to the widget (via data-* attributes or VettingChat.init). */
export interface WidgetConfig {
  audience: Audience;
  region?: Region;
  /** Short-lived signed token issued by the client/candidate portal. Never set on the public site. */
  authToken?: string;
  /** Base URL of the Chat Gateway. Defaults to http://localhost:8787 in development. */
  gatewayUrl: string;
  /** Open the chat window immediately on load. */
  startOpen?: boolean;
}

export type Role = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  /** True while tokens are still streaming in. */
  pending?: boolean;
}

/** Returned by POST /session. The gateway decides the audience from the verified token. */
export interface SessionResponse {
  sessionId: string;
  audience: Audience;
  authenticated: boolean;
}

/** Events streamed by POST /chat (Server-Sent Events, one JSON object per `data:` line). */
export type ChatStreamEvent =
  | { type: "token"; text: string }
  | { type: "handoff_suggested"; reason?: string }
  | { type: "done" }
  | { type: "error"; message: string };

/** "Who are you?" — only asked on the public site; portals already know. */
export type VisitorType = "candidate" | "client" | "referee";

export interface HandoffRequest {
  sessionId: string;
  name: string;
  email: string;
  issue: string;
  visitorType?: VisitorType;
  region?: Region;
}

export interface HandoffResponse {
  ticketRef: string;
}

export interface CaseSummary {
  ticketRef: string;
  subject: string;
  status: string;
  updatedAt: string;
}
