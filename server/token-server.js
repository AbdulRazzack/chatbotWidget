// Production token server.
//
// The ONLY job of this service: swap a Copilot Studio Direct Line secret (kept here, never in the
// browser) for a short-lived Direct Line token, choosing which of the three front agents to connect
// to from the *verified* portal login. Copilot Studio does everything else (answers, ticketing).
//
// Run:  node server/token-server.js   (see .env.example for configuration)

import express from "express";
import cors from "cors";
import { createHash, randomUUID } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

const env = (name, fallback) => {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var ${name}`);
  return v;
};

const PORT = Number(env("PORT", "8787"));
// Regional Direct Line endpoint for the Copilot Studio environment (UK → europe).
const DIRECTLINE_DOMAIN = env("DIRECTLINE_DOMAIN", "https://europe.directline.botframework.com/v3/directline");
const ALLOWED_ORIGINS = env("ALLOWED_ORIGINS", "").split(",").map((s) => s.trim()).filter(Boolean);

// One Direct Line secret per front agent (Copilot Studio → agent → Settings → Security → Web channel security).
const SECRETS = {
  public: env("DIRECTLINE_SECRET_PUBLIC"),
  client: env("DIRECTLINE_SECRET_CLIENT"),
  candidate: env("DIRECTLINE_SECRET_CANDIDATE"),
};

// Portal login verification. Agree the token format with VETTING's dev team; these are placeholders.
const PORTAL_JWKS_URL = process.env.PORTAL_JWKS_URL;
const PORTAL_ISSUER = process.env.PORTAL_ISSUER;
const PORTAL_AUDIENCE = process.env.PORTAL_AUDIENCE;
const ROLE_CLAIM = env("PORTAL_ROLE_CLAIM", "vetting_role"); // expected values: "client" | "candidate"
const jwks = PORTAL_JWKS_URL ? createRemoteJWKSet(new URL(PORTAL_JWKS_URL)) : null;

/** Returns { audience, userId, authenticated } or throws if a supplied token is invalid. */
async function identify(authHeader) {
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    // Anonymous public visitor. Direct Line user ids must start with "dl_" when using enhanced auth.
    return { audience: "public", userId: `dl_${randomUUID()}`, authenticated: false };
  }
  if (!jwks) throw new Error("Portal tokens are not configured on this server");

  const { payload } = await jwtVerify(token, jwks, { issuer: PORTAL_ISSUER, audience: PORTAL_AUDIENCE });
  const role = payload[ROLE_CLAIM];
  if (role !== "client" && role !== "candidate") throw new Error("Token has no valid role");
  // Stable, non-reversible id so the agent can recognise returning users without seeing their portal id.
  const hashed = createHash("sha256").update(String(payload.sub)).digest("hex").slice(0, 24);
  return { audience: role, userId: `dl_${role}_${hashed}`, authenticated: true };
}

// Tiny in-memory rate limiter (per IP). Use a shared store (e.g. Redis) if you run more than one instance.
const hits = new Map();
function rateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 20) return res.status(429).json({ error: "Too many requests" });
  recent.push(now);
  hits.set(key, recent);
  next();
}

const app = express();
app.set("trust proxy", 1);
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin)),
    methods: ["POST"],
  }),
);
app.use(express.json({ limit: "2kb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/token", rateLimit, async (req, res) => {
  let who;
  try {
    who = await identify(req.get("Authorization"));
  } catch (e) {
    return res.status(401).json({ error: "Invalid portal token" });
  }

  // TODO (public site): verify a bot-protection token (e.g. Cloudflare Turnstile) here before issuing.

  try {
    const r = await fetch(`${DIRECTLINE_DOMAIN}/tokens/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SECRETS[who.audience]}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user: { id: who.userId } }),
    });
    if (!r.ok) {
      console.error("Direct Line token generation failed", r.status, await r.text());
      return res.status(502).json({ error: "Could not start conversation" });
    }
    const { token } = await r.json();
    res.json({
      token,
      domain: DIRECTLINE_DOMAIN,
      userId: who.userId,
      audience: who.audience,
      authenticated: who.authenticated,
      webSocket: true,
    });
  } catch (e) {
    console.error("Direct Line unreachable", e);
    res.status(502).json({ error: "Could not start conversation" });
  }
});

app.listen(PORT, () => console.log(`Token server on :${PORT}`));
