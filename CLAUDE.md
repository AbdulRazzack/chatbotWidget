# CLAUDE.md

Context for AI coding assistants working in this repo.

## What this is
An embeddable React + TypeScript chat widget for VETTING.com (UK/AU background-screening company).
The **same widget** runs on three sites: public website, client portal, candidate portal.
It talks only to a Chat Gateway backend, which runs the AI agents and creates HubSpot tickets.

## Key decisions
- Vite library mode → one IIFE file `dist/widget.js`. Public API: `window.VettingChat.init/destroy`.
- Rendered inside a Shadow DOM; styles are imported with `?inline` and injected into the shadow root.
- Per-audience UI copy lives in `src/config/audiences.ts`. Audience-specific *behaviour* belongs in the gateway.
- Chat replies stream over SSE from `POST /chat` (parsed manually in `src/api/client.ts`, since EventSource can't POST).
- `mock-gateway/server.js` defines the API contract the real gateway must match. Keep `src/types.ts`, the mock and the README table in sync.

## Rules
- Never add secrets, HubSpot tokens or LLM keys to frontend code.
- Treat `data-audience` as an untrusted hint. Trust only what the gateway returns from `/session`.
- Never show "ticket logged" without a `ticketRef` from the gateway.
- Keep the widget accessible: labelled controls, keyboard support, `aria-live` message log.
- Keep bundle size in mind; avoid heavy UI libraries.

## Commands
- `npm start` — mock gateway (:8787) + dev server (:5173)
- `npm run build` — typecheck + build `dist/widget.js`
- `npm run typecheck`

## HubSpot target (handled by gateway, not widget)
Support Pipeline → status New, Source = Chat, Category = Candidate/Client/Referee, AU/UK Prod from region.
