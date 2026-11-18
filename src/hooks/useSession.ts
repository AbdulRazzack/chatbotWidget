import { useEffect, useState } from "react";
import type { GatewayClient } from "../api/client";
import type { SessionResponse } from "../types";

const STORAGE_KEY = "vetting-chat-session";

function readStored(): string | undefined {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined; // storage blocked (private mode, sandboxed iframe, etc.)
  }
}

function writeStored(id: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* non-fatal */
  }
}

/** Starts (or resumes, per browser tab) a gateway session once the chat is first opened. */
export function useSession(client: GatewayClient, enabled: boolean) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || session) return;
    let cancelled = false;
    client
      .createSession(readStored())
      .then((s) => {
        if (cancelled) return;
        writeStored(s.sessionId);
        setSession(s);
        setError(null);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [client, enabled, session]);

  return { session, error };
}
