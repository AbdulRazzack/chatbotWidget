# CLAUDE.md

Context for AI coding assistants working in this repo.

## What this is
An embeddable React + TypeScript chat widget for VETTING.com (UK/AU background-screening company).
The **same widget** runs on three sites (public, client portal, candidate portal) and talks to
**Microsoft Copilot Studio** over **Direct Line**:
- 3 front agents (public / client / candidate), one per site
- 1 backend **Ticketing** agent, connected to all three, which creates HubSpot tickets via Power Automate

## Key decisions
- Vite library mode → one IIFE file `dist/widget.js`. Public API: `window.VettingChat.init/destroy`.
- Rendered inside a Shadow DOM; CSS imported with `?inline` and injected into the shadow root.
- `server/token-server.js` swaps a per-agent Direct Line secret for a short-lived token and picks the agent
  from the **verified** portal JWT. The widget never holds secrets.
- `src/hooks/useConversation.ts` owns the Direct Line connection (botframework-directlinejs).
  Copilot Studio doesn't stream over Direct Line, so we show a typing indicator instead.
- Widget ↔ agent events (`startConversation`, `handoffRequest`, `ticketCreated`, `ticketFailed`,
  `handoffSuggested`) are defined in `src/types.ts` `EVENTS` and documented in `COPILOT_STUDIO.md`.
  Keep those two and `mock-copilot/server.js` in sync.

## Rules
- Never add secrets, Direct Line secrets, HubSpot tokens or LLM keys to frontend code.
- Treat `data-audience` as an untrusted hint; the token server decides.
- Never show "ticket logged" without a `ticketCreated` event carrying a `ticketRef`.
- Render agent text with `RichText` (no `dangerouslySetInnerHTML`).
- Keep the widget accessible: labelled controls, keyboard support, `aria-live` message log.

## Commands
- `npm start`: mock Copilot Studio (:8787) + dev server (:5173)
- `npm run build`: typecheck + build `dist/widget.js`
- `npm run token-server`: real token server (needs `.env`, see `.env.example`)
