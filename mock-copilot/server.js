// Mock of the whole Copilot Studio side, for local development without a Microsoft environment:
//
//   POST /token                      → our token server (accepts fake dev portal tokens)
//   /v3/directline/*                 → a minimal Direct Line API (polling mode)
//   3 front agents                   → public / client / candidate canned replies
//   Ticketing Agent                  → one shared function all three call; logs the HubSpot ticket it WOULD create
//
// The widget code is identical against this mock and against real Copilot Studio: only the
// token server's response (domain + webSocket) differs. NOT for production.

import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? 8787);
const BASE = `http://localhost:${PORT}`;
const app = express();
app.use(cors());
app.use(express.json({ limit: "20kb" }));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Token server (mock) ──────────────────────────────────────────────────────────────
/** Direct Line token → { audience, userId } */
const tokens = new Map();

function identify(authHeader) {
  const t = authHeader?.replace(/^Bearer\s+/i, "");
  if (t === "dev-token-client") return { audience: "client", userId: "dl_client_dev", authenticated: true };
  if (t === "dev-token-candidate") return { audience: "candidate", userId: "dl_candidate_dev", authenticated: true };
  if (t) return null; // unknown token → reject, like the real server
  return { audience: "public", userId: `dl_${randomUUID()}`, authenticated: false };
}

app.post("/token", (req, res) => {
  // Audience comes from the portal token, NOT from requestedAudience (that's only a hint).
  const who = identify(req.get("Authorization"));
  if (!who) return res.status(401).json({ error: "Invalid portal token" });
  const token = `mock-dl-${randomUUID()}`;
  tokens.set(token, who);
  res.json({ token, domain: `${BASE}/v3/directline`, webSocket: false, ...who });
});

// ─── Minimal Direct Line v3 (polling) ─────────────────────────────────────────────────
/** conversationId → { audience, userId, activities[], ticketRef? } */
const conversations = new Map();

function auth(req, res) {
  const who = tokens.get(req.get("Authorization")?.replace(/^Bearer\s+/i, ""));
  if (!who) res.status(403).json({ error: { code: "BadArgument", message: "Invalid token" } });
  return who;
}

function botSays(convId, activity) {
  const c = conversations.get(convId);
  c.activities.push({
    id: `${convId}|${c.activities.length}`,
    timestamp: new Date().toISOString(),
    from: { id: `vetting-${c.audience}-agent`, role: "bot" },
    conversation: { id: convId },
    ...activity,
  });
}

app.post("/v3/directline/conversations", (req, res) => {
  const who = auth(req, res);
  if (!who) return;
  const conversationId = randomUUID();
  conversations.set(conversationId, { ...who, activities: [] });
  res.status(201).json({ conversationId, token: req.get("Authorization").slice(7), expires_in: 3600 });
});

app.post("/v3/directline/tokens/refresh", (req, res) => {
  if (!auth(req, res)) return;
  res.json({ token: req.get("Authorization").slice(7), expires_in: 3600 });
});

app.get("/v3/directline/conversations/:id/activities", (req, res) => {
  if (!auth(req, res)) return;
  const c = conversations.get(req.params.id);
  if (!c) return res.status(404).end();
  const from = Number(req.query.watermark || 0);
  res.json({ activities: c.activities.slice(from), watermark: String(c.activities.length) });
});

app.post("/v3/directline/conversations/:id/activities", (req, res) => {
  const who = auth(req, res);
  if (!who) return;
  const convId = req.params.id;
  const c = conversations.get(convId);
  if (!c) return res.status(404).end();
  // Like real Direct Line: the token is bound to one user id.
  if (req.body?.from?.id !== who.userId) return res.status(400).json({ error: "from.id does not match token" });

  const id = `${convId}|${c.activities.length}`;
  c.activities.push({ ...req.body, id, conversation: { id: convId } });
  res.json({ id });
  void frontAgent(convId, req.body).catch((e) => console.error(e));
});

// ─── 3 front agents ──────────────────────────────────────────────────────────────────
const CANNED = {
  public: [
    [/dbs/i, "A **Basic DBS** check usually takes a few days; Standard and Enhanced checks can take longer. I can't promise a turnaround for a specific case.", false, ["What's the difference between DBS levels?", "Talk to a person"]],
    [/referee|reference/i, "If you've been asked for a reference, use the link in the email you received. If it's expired, our team can help.", true],
    [/check/i, "We offer Referencing, DBS (Basic, Standard, Enhanced), Right to Work, Identity Verification, Credit and international checks. See [our services](https://www.vetting.com) for more.", false, ["DBS checks", "Right to Work", "Referencing"]],
  ],
  client: [
    [/submit/i, "If a candidate can't submit, ask them to complete every required section and try another browser. If it still fails, I can raise a ticket.", true],
    [/licen[cs]e/i, "Licence upgrades and renewals are handled by our team. I can raise a request for you.", true],
    [/log ?in/i, "Try resetting your password from the login page. If that doesn't work, I can raise a ticket.", true],
  ],
  candidate: [
    [/link|expired/i, "Check links expire after a set period. I can't reissue it myself, but our support team can.", true],
    [/submit/i, "Make sure all required fields are filled in and documents are in a supported format. If it still won't submit, I can pass this to our team.", true],
    [/document/i, "The documents you need depend on the checks your employer requested; you'll see the list in your application. Please upload them there, never in this chat.", false],
  ],
};

async function frontAgent(convId, activity) {
  const c = conversations.get(convId);

  if (activity.type === "event" && activity.name === "startConversation") {
    console.log(`[${c.audience} agent] conversation started`, activity.value);
    return;
  }

  if (activity.type === "event" && activity.name === "handoffRequest") {
    botSays(convId, { type: "typing" });
    const v = activity.value ?? {};
    // The FRONT agent decides Category; the Ticketing Agent never guesses it.
    const category =
      c.audience === "client" ? "Client" : c.audience === "candidate" ? "Candidate" : capitalise(v.visitorType);
    try {
      const ticketRef = await ticketingAgent({ conversationId: convId, category, ...v });
      botSays(convId, { type: "event", name: "ticketCreated", value: { ticketRef } });
      botSays(convId, { type: "message", text: `I've passed this to our support team. Your reference is **${ticketRef}**.` });
    } catch (e) {
      botSays(convId, { type: "event", name: "ticketFailed", value: { message: e.message } });
    }
    return;
  }

  if (activity.type !== "message") return;
  botSays(convId, { type: "typing" });
  await sleep(700); // Copilot Studio doesn't stream over Direct Line; replies arrive whole.

  const hit = CANNED[c.audience].find(([re]) => re.test(activity.text ?? ""));
  if (hit) {
    const [, text, handoff, suggestions] = hit;
    botSays(convId, {
      type: "message",
      text,
      ...(suggestions && { suggestedActions: { actions: suggestions.map((s) => ({ type: "imBack", title: s, value: s })) } }),
    });
    if (handoff) botSays(convId, { type: "event", name: "handoffSuggested" });
  } else {
    botSays(convId, {
      type: "message",
      text: `(mock **${c.audience}** agent) The real Copilot Studio agent will answer here. You said: "${String(activity.text).slice(0, 200)}"`,
    });
  }
}

const capitalise = (s) => (s ? s[0].toUpperCase() + s.slice(1) : undefined);

// ─── Ticketing Agent (shared by all three) ───────────────────────────────────────────
/** conversationId → ticketRef, so repeat requests reuse the ticket instead of duplicating it. */
const ticketsByConversation = new Map();
let counter = 1000;

async function ticketingAgent(input) {
  const { conversationId, category, name, email, issue, region } = input;
  if (!name || !email || !issue || !category) throw new Error("Missing required ticket inputs");
  await sleep(600);
  if (String(email).includes("fail")) throw new Error("HubSpot unavailable (simulated)");

  const existing = ticketsByConversation.get(conversationId);
  if (existing) {
    console.log(`[ticketing agent] reusing ${existing} for conversation ${conversationId}`);
    return existing;
  }

  const ticketRef = `VET-${++counter}`;
  ticketsByConversation.set(conversationId, ticketRef);
  // What the real Power Automate flow should send to HubSpot (see Chatbot Integration Doc).
  console.log(`[ticketing agent] would create HubSpot ticket ${ticketRef}:`, {
    contact: { email, name },
    ticket: {
      subject: `External chatbot – ${String(issue).slice(0, 60)}`,
      pipeline: "Support Pipeline",
      status: "New",
      source: "Chat",
      category,
      auUkProd: region === "AU" ? "AU Prod" : region === "UK" ? "UK Prod" : undefined,
      description: issue,
      correlationId: conversationId,
    },
  });
  return ticketRef;
}

app.listen(PORT, () => console.log(`Mock Copilot Studio (token + Direct Line + agents) on ${BASE}`));
