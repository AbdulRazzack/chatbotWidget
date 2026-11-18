import type {
  CaseSummary,
  ChatStreamEvent,
  HandoffRequest,
  HandoffResponse,
  SessionResponse,
  WidgetConfig,
} from "../types";

/** Thin typed wrapper around the Chat Gateway. Holds no secrets: only the portal's own short-lived token. */
export class GatewayClient {
  constructor(private readonly config: WidgetConfig) {}

  private headers(sessionId?: string): HeadersInit {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.authToken) h.Authorization = `Bearer ${this.config.authToken}`;
    if (sessionId) h["X-Session-Id"] = sessionId;
    return h;
  }

  private url(path: string) {
    return `${this.config.gatewayUrl.replace(/\/$/, "")}${path}`;
  }

  async createSession(existingSessionId?: string): Promise<SessionResponse> {
    const res = await fetch(this.url("/session"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        // A hint only; the gateway decides the real audience from the token.
        requestedAudience: this.config.audience,
        region: this.config.region,
        sessionId: existingSessionId,
      }),
    });
    if (!res.ok) throw new Error(`Could not start chat (${res.status})`);
    return res.json();
  }

  /** Streams the agent's reply. Calls onEvent for every SSE event until the stream ends. */
  async streamChat(
    sessionId: string,
    message: string,
    onEvent: (e: ChatStreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const res = await fetch(this.url("/chat"), {
      method: "POST",
      headers: { ...this.headers(sessionId), Accept: "text/event-stream" },
      body: JSON.stringify({ sessionId, message }),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`Chat request failed (${res.status})`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line.
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const line of raw.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            onEvent(JSON.parse(payload) as ChatStreamEvent);
          } catch {
            // Ignore malformed events rather than breaking the conversation.
          }
        }
      }
    }
  }

  async submitHandoff(req: HandoffRequest): Promise<HandoffResponse> {
    const res = await fetch(this.url("/handoff"), {
      method: "POST",
      headers: this.headers(req.sessionId),
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Ticket could not be created (${res.status})`);
    const data = (await res.json()) as Partial<HandoffResponse>;
    // Only treat it as logged if the gateway returned a real ticket reference.
    if (!data.ticketRef) throw new Error("No ticket reference returned");
    return { ticketRef: data.ticketRef };
  }

  async listCases(sessionId: string): Promise<CaseSummary[]> {
    const res = await fetch(this.url("/cases"), { headers: this.headers(sessionId) });
    if (!res.ok) throw new Error(`Could not load cases (${res.status})`);
    return res.json();
  }
}
