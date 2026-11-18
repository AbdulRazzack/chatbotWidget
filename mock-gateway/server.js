// Mock Chat Gateway: lets the widget run locally before the real agent + HubSpot service exist.
// It implements the same 4 endpoints and response shapes the real gateway must provide.
//
// NOT for production: tokens are fake, nothing is persisted, no HubSpot calls are made.

import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? 8787);
const app = express();
app.use(cors());
app.use(express.json({ limit: "20kb" }));

/** sessionId -> { audience, userId, ticketRef? } */
const sessions = new Map();

// In the real gateway this verifies a signed JWT from the portal. Here we accept fake dev tokens.
function audienceFromToken(authHeader) {
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (token === "dev-token-client") return { audience: "client", userId: "client-123" };
  if (token === "dev-token-candidate") return { audience: "candidate", userId: "candidate-456" };
  return { audience: "public", userId: null };
}

function getSession(req, res) {
  const id = req.get("X-Session-Id") ?? req.body?.sessionId;
  const s = id && sessions.get(id);
  if (!s) {
    res.status(401).json({ error: "Unknown or expired session" });
    return null;
  }
  return { id, ...s };
}

app.post("/session", (req, res) => {
  // Audience comes from the token, NOT from requestedAudience (that's only a hint).
  const { audience, userId } = audienceFromToken(req.get("Authorization"));
  const existing = req.body?.sessionId;
  const sessionId = existing && sessions.has(existing) ? existing : randomUUID();
  sessions.set(sessionId, { audience, userId });
  res.json({ sessionId, audience, authenticated: Boolean(userId) });
});

const CANNED = {
  public: {
    dbs: "A Basic DBS check usually takes a few days; Standard and Enhanced checks can take longer depending on the police forces involved. I can't give a guaranteed turnaround — our team can advise on a specific case.",
    referee: "If you've been asked to give a reference, use the link in the email you received. If it's expired or not working, I can pass you to our support team.",
    checks: "VETTING offers checks including Referencing, DBS (Basic, Standard, Enhanced), Right to Work, Identity Verification, Credit, and international criminal checks. Which one are you interested in?",
  },
  client: {
    submit: "If a candidate can't submit, ask them to check every required section is complete and try a different browser. If it still fails, I can raise a ticket with the candidate's check type so the team can investigate.",
    licence: "Licence upgrades and renewals are handled by our team. I can raise a request for you now.",
    login: "Try resetting your password from the login page. If you still can't get in, I can raise a ticket for our support team.",
  },
  candidate: {
    link: "Check links expire after a set period. I can't reissue it myself, but our support team can — shall I put you in touch?",
    submit: "Make sure all required fields are filled in and any documents are uploaded in a supported format. If it still won't submit, I can pass this to our team.",
    documents: "The documents you need depend on the checks your employer requested. You'll see the list inside your application. Please upload documents there, never in this chat.",
  },
};

function pickReply(audience, message) {
  const m = message.toLowerCase();
  const r = CANNED[audience];
  if (audience === "public") {
    if (m.includes("dbs")) return { text: r.dbs };
    if (m.includes("referee") || m.includes("reference")) return { text: r.referee, handoff: true };
    if (m.includes("check")) return { text: r.checks };
  }
  if (audience === "client") {
    if (m.includes("submit")) return { text: r.submit, handoff: true };
    if (m.includes("licence") || m.includes("license")) return { text: r.licence, handoff: true };
    if (m.includes("log in") || m.includes("login")) return { text: r.login, handoff: true };
  }
  if (audience === "candidate") {
    if (m.includes("link") || m.includes("expired")) return { text: r.link, handoff: true };
    if (m.includes("submit")) return { text: r.submit, handoff: true };
    if (m.includes("document")) return { text: r.documents };
  }
  return {
    text: `(mock ${audience} agent) I'm a placeholder reply. The real agent will answer here. You said: "${message.slice(0, 200)}"`,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.post("/chat", async (req, res) => {
  const s = getSession(req, res);
  if (!s) return;
  const message = String(req.body?.message ?? "").slice(0, 2000);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  let closed = false;
  // Use the response's close event: req "close" fires as soon as the request body is consumed.
  res.on("close", () => (closed = true));

  const { text, handoff } = pickReply(s.audience, message);
  await sleep(400);
  for (const word of text.split(/(\s+)/)) {
    if (closed) return;
    send({ type: "token", text: word });
    await sleep(25);
  }
  if (handoff) send({ type: "handoff_suggested", reason: "Agent cannot resolve this alone" });
  send({ type: "done" });
  res.end();
});

let ticketCounter = 1000;
app.post("/handoff", async (req, res) => {
  const s = getSession(req, res);
  if (!s) return;
  const { name, email, issue, visitorType } = req.body ?? {};
  if (!name || !email || !issue) return res.status(400).json({ error: "name, email and issue are required" });
  if (s.audience === "public" && !visitorType) return res.status(400).json({ error: "visitorType is required" });

  // Real gateway: redact -> find/create HubSpot contact -> create ticket in Support Pipeline / New
  // (Source = Chat, Category from audience/visitorType) -> add note with sanitised transcript.
  await sleep(600);
  if (email.includes("fail")) return res.status(502).json({ error: "HubSpot unavailable (simulated)" });

  const sessionData = sessions.get(s.id);
  // Reuse the ticket for this conversation instead of creating duplicates.
  const ticketRef = sessionData.ticketRef ?? `VET-${++ticketCounter}`;
  sessionData.ticketRef = ticketRef;
  console.log(`[mock] ticket ${ticketRef} for ${s.audience}`, { name, email, visitorType, issue: issue.slice(0, 80) });
  res.json({ ticketRef });
});

app.get("/cases", (req, res) => {
  const s = getSession(req, res);
  if (!s) return;
  if (s.audience === "public") return res.status(403).json({ error: "Login required" });
  res.json([
    { ticketRef: "VET-0991", subject: "DBS Enhanced – unable to submit", status: "Waiting on Customer Success", updatedAt: new Date().toISOString() },
  ]);
});

app.listen(PORT, () => console.log(`Mock gateway on http://localhost:${PORT}`));
