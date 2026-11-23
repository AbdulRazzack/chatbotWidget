export type Audience = "public" | "client" | "candidate";
export type Region = "UK" | "AU";

/** Options a host page passes to the widget (via data-* attributes or VettingChat.init). */
export interface WidgetConfig {
  audience: Audience;
  region?: Region;
  /** Short-lived signed token issued by the client/candidate portal. Never set on the public site. */
  authToken?: string;
  /** Our token server, which exchanges a Copilot Studio Direct Line secret for a conversation token. */
  tokenUrl: string;
  /** Open the chat window immediately on load. */
  startOpen?: boolean;
}

export type Role = "user" | "assistant" | "system";

export interface ChatAttachment {
  name: string;
  contentType: string;
  /** Object URL for the visitor's own uploads; https URL for files sent by the agent. */
  url: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  attachments?: ChatAttachment[];
}

/**
 * Returned by POST {tokenUrl}. The token server decides the audience (and therefore which
 * Copilot Studio agent) from the verified portal token — never from the page's data-audience.
 */
export interface TokenResponse {
  token: string;
  /** Direct Line base URL, e.g. https://europe.directline.botframework.com/v3/directline */
  domain: string;
  /** The Direct Line user id the token is bound to. Activities must be sent "from" this id. */
  userId: string;
  audience: Audience;
  authenticated: boolean;
  /** WebSocket in production; the local mock uses polling. */
  webSocket: boolean;
}

/** "Who are you?" — only asked on the public site; portals already know. */
export type VisitorType = "candidate" | "client" | "referee";

/** Value of the `handoffRequest` event the widget sends to the front agent. */
export interface HandoffRequest {
  name: string;
  email: string;
  issue: string;
  visitorType?: VisitorType;
  region?: Region;
  pageUrl: string;
}

/** Event names exchanged with Copilot Studio. Keep in sync with COPILOT_STUDIO.md. */
export const EVENTS = {
  /** widget → agent, once per conversation: context for the agent's global variables. */
  startConversation: "startConversation",
  /** widget → agent: the handoff form was submitted. */
  handoffRequest: "handoffRequest",
  /** agent → widget: Ticketing Agent created (or reused) a HubSpot ticket. value: { ticketRef } */
  ticketCreated: "ticketCreated",
  /** agent → widget: ticket creation failed. value: { message? } */
  ticketFailed: "ticketFailed",
  /** agent → widget: show the "contact support" nudge. */
  handoffSuggested: "handoffSuggested",
} as const;
