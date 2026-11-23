import type { TokenResponse, WidgetConfig } from "../types";

/**
 * Asks OUR token server for a Direct Line token. The Direct Line secrets for the three
 * Copilot Studio agents live only on that server; the browser only ever sees a short-lived token.
 */
export async function fetchDirectLineToken(config: WidgetConfig): Promise<TokenResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.authToken) headers.Authorization = `Bearer ${config.authToken}`;

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    // requestedAudience is a hint only; the server decides from the verified portal token.
    body: JSON.stringify({ requestedAudience: config.audience, region: config.region }),
  });
  if (!res.ok) throw new Error(`Could not start chat (${res.status})`);

  const data = (await res.json()) as Partial<TokenResponse>;
  if (!data.token || !data.domain || !data.userId || !data.audience) {
    throw new Error("Token server returned an incomplete response");
  }
  return data as TokenResponse;
}
