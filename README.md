# VETTING Chat Widget

One embeddable React chat widget used on all three VETTING sites, connected to **Microsoft Copilot Studio** agents.

| Site | Audience | Copilot Studio agent | Login |
|---|---|---|---|
| Public website | `public` | VETTING Public | None |
| Client portal | `client` | VETTING Client | Portal-issued token |
| Candidate portal | `candidate` | VETTING Candidate | Portal-issued token |

All three front agents hand off to one backend **VETTING Ticketing** agent, which creates HubSpot tickets.

```
                                   ┌─ Public agent ────┐
Website ─► Widget ─(Direct Line)─► ├─ Client agent ────┤ ─(connected agent)─► Ticketing agent ─► Power Automate ─► HubSpot
              │                    └─ Candidate agent ─┘
              └─► Token server (ours): verifies login, picks the agent, swaps its Direct Line secret for a short-lived token
```

The browser never sees a Direct Line secret or a HubSpot token.

## Quick start (no Microsoft account needed)

```bash
npm install
npm start          # mock Copilot Studio on :8787 + widget dev server on :5173
```

Open http://localhost:5173 and switch between public / client / candidate.

Try *"How long does a DBS check take?"*, *"My check link has expired"*, or **Talk to a person**.
In the handoff form, an email containing `fail` simulates HubSpot being down.
The mock's terminal shows the HubSpot ticket the Ticketing agent *would* create.

### Test the production bundle

```bash
npm run build      # -> dist/widget.js (single file)
npm run mock       # terminal 1
npx serve .        # terminal 2 → http://localhost:3000/demo/public.html
```

## Going live with real Copilot Studio

1. Build the four agents. See **[COPILOT_STUDIO.md](COPILOT_STUDIO.md)** for the event contract and ticketing inputs.
2. `cp .env.example .env` and fill in the three Direct Line secrets, allowed origins and portal token settings.
3. `npm run token-server`, then deploy it (e.g. Azure App Service) behind HTTPS.
4. Point each site's embed at it with `data-token-url`.

## Embedding

**Public website**

```html
<script src="https://chat.vetting.com/widget.js"
        data-audience="public"
        data-region="UK"
        data-token-url="https://chat-api.vetting.com/token"
        async></script>
```

**Client / candidate portal** (pass the logged-in user's short-lived token)

```html
<script src="https://chat.vetting.com/widget.js"
        data-audience="candidate"
        data-token-url="https://chat-api.vetting.com/token"
        data-manual-init="true"></script>
<script>
  window.VettingChat.init({ authToken: "<short-lived token from portal backend>" });
</script>
```

| Attribute / option | Values | Notes |
|---|---|---|
| `data-audience` / `audience` | `public` \| `client` \| `candidate` | UI hint only; token server decides the real audience from the login |
| `data-region` / `region` | `UK` \| `AU` | Sent to the agent; maps to HubSpot "AU / UK Prod" |
| `data-token-url` / `tokenUrl` | URL | Defaults to `http://localhost:8787/token` |
| `data-start-open` / `startOpen` | `true` | Open on load |
| `data-manual-init` | `true` | Don't auto-start; call `VettingChat.init()` yourself |
| `authToken` (JS only) | string | Portal login token |

JS API: `window.VettingChat.init(options)`, `window.VettingChat.destroy()`.

## Token server API

`POST /token` (optional `Authorization: Bearer <portal token>`) →

```json
{ "token": "…", "domain": "https://europe.directline.botframework.com/v3/directline",
  "userId": "dl_…", "audience": "candidate", "authenticated": true, "webSocket": true }
```

An invalid portal token returns `401`. There's no silent downgrade to public.

## Security rules

- Direct Line secrets live only in the token server's environment; HubSpot credentials only in Power Automate.
- Turn on web channel security on each front agent so it can't be reached by agent ID alone.
- The token server decides audience and user id from the **verified** login, never from `data-audience`.
- "Ticket logged" is shown only when the agent sends `ticketCreated` with a reference.
- Agent replies are rendered as text (tiny safe markdown subset, no HTML injection).

## Project structure

```
src/
  main.tsx                 loader: data-* attrs → Shadow DOM mount → window.VettingChat
  App.tsx                  launcher + window
  config/audiences.ts      per-audience greeting, quick replies, labels
  api/tokenClient.ts       calls our token server
  hooks/useConversation.ts Direct Line connection, messages, typing, suggested actions, ticket events
  components/              Launcher, ChatWindow, MessageList, RichText, Composer, QuickReplies, HandoffForm, TicketConfirmation
  styles/widget.css        scoped styles; brand colours are CSS variables at the top
server/token-server.js     production token server
mock-copilot/server.js     local mock: token server + Direct Line + 3 agents + ticketing agent
demo/                      pages loading the built dist/widget.js
COPILOT_STUDIO.md          what the agent builders must implement
```

## Next steps

- [ ] Build the four agents in Copilot Studio (COPILOT_STUDIO.md)
- [ ] Power Automate flow: Ticketing agent → HubSpot
- [ ] Portal token format agreed with VETTING dev team
- [ ] Bot protection (e.g. Turnstile) on the public site's `/token`
- [ ] VETTING brand colours / logo
- [ ] Host `widget.js` (CDN) and the token server
- [ ] Bundle size: Direct Line client is ~140 KB gzipped; consider lazy-loading it on first open
