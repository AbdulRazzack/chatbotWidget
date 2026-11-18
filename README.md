# VETTING Chat Widget

One embeddable React chat widget used on all three VETTING sites:

| Site | Audience | Login |
|---|---|---|
| Public website | `public` | None |
| Client portal | `client` | Portal-issued token |
| Candidate portal | `candidate` | Portal-issued token |

The widget only talks to the **Chat Gateway** (our backend). The gateway runs the agents and creates HubSpot tickets. No secrets ever live in the widget.

```
Website ──<script>──► Widget (React, Shadow DOM) ──HTTPS/SSE──► Chat Gateway ──► Agent (LLM)
                                                                     └──────────► HubSpot (tickets)
```

## Quick start

```bash
npm install
npm start          # mock gateway on :8787 + widget dev server on :5173
```

Open http://localhost:5173 and use the buttons to switch between public / client / candidate.

Try: *"How long does a DBS check take?"*, *"My check link has expired"*, or *"Talk to a person"*.
Using an email containing `fail` in the handoff form simulates HubSpot being down.

### Test the production bundle

```bash
npm run build      # -> dist/widget.js (single file, React included)
npm run mock       # in one terminal
npx serve .        # in another, then open http://localhost:3000/demo/public.html
```

## Embedding

**Public website**

```html
<script src="https://chat.vetting.com/widget.js"
        data-audience="public"
        data-region="UK"
        data-gateway-url="https://chat-api.vetting.com"
        async></script>
```

**Client / candidate portal** (pass the logged-in user's short-lived token)

```html
<script src="https://chat.vetting.com/widget.js"
        data-audience="candidate"
        data-gateway-url="https://chat-api.vetting.com"
        data-manual-init="true"></script>
<script>
  window.VettingChat.init({ authToken: "<short-lived token from portal backend>" });
</script>
```

| Attribute / option | Values | Notes |
|---|---|---|
| `data-audience` / `audience` | `public` \| `client` \| `candidate` | UI hint only; gateway decides real audience from token |
| `data-region` / `region` | `UK` \| `AU` | Maps to HubSpot "AU / UK Prod" |
| `data-gateway-url` / `gatewayUrl` | URL | Defaults to `http://localhost:8787` |
| `data-start-open` / `startOpen` | `true` | Open on load |
| `data-manual-init` | `true` | Don't auto-start; call `VettingChat.init()` yourself |
| `authToken` (JS only) | string | Never put this in HTML attributes on a cached page |

JS API: `window.VettingChat.init(options)`, `window.VettingChat.destroy()`.

## Gateway API contract

The real gateway must implement these endpoints with the same shapes as `mock-gateway/server.js`.
Types live in `src/types.ts`.

| Method & path | Request | Response |
|---|---|---|
| `POST /session` | `Authorization: Bearer <token>` (optional), body `{ requestedAudience, region, sessionId? }` | `{ sessionId, audience, authenticated }` |
| `POST /chat` | header `X-Session-Id`, body `{ sessionId, message }` | `text/event-stream`, each `data:` line is one of `{type:"token",text}`, `{type:"handoff_suggested",reason?}`, `{type:"error",message}`, `{type:"done"}` |
| `POST /handoff` | body `{ sessionId, name, email, issue, visitorType?, region? }` | `{ ticketRef }` — only after HubSpot confirms creation |
| `GET /cases` | header `X-Session-Id` (client/candidate only) | `[{ ticketRef, subject, status, updatedAt }]` scoped to the logged-in user |

### Handoff → HubSpot mapping (gateway side)

| Widget data | HubSpot field |
|---|---|
| — | Pipeline = Support Pipeline, Ticket status = New, Source = Chat |
| audience / `visitorType` | Category (Candidate / Client / Referee) |
| `region` | AU / UK Prod |
| `issue` + chat summary | Ticket name ("External chatbot – …") and description, sanitised transcript as a note |
| `name`, `email` | Contact (search, else create) associated to the ticket |

See *Chatbot Integration Doc* in the project for the full spec.

## Security rules

- No HubSpot or LLM keys in this repo's frontend code. Ever.
- The gateway derives audience and identity from the **verified token**, never from `data-audience`.
- Public sessions get bot protection (e.g. Cloudflare Turnstile) and rate limits at the gateway.
- Don't ask for passwords, passport images or criminal-record details in chat; the gateway redacts before sending anything to the LLM or HubSpot.
- Only say "ticket logged" when the gateway returns a `ticketRef`.

## Project structure

```
src/
  main.tsx              loader: reads data-* attrs, mounts into Shadow DOM, exposes window.VettingChat
  App.tsx               launcher + window
  config/audiences.ts   per-audience copy and quick replies
  api/client.ts         typed gateway client (incl. SSE parsing)
  hooks/                useSession, useChatStream
  components/           Launcher, ChatWindow, MessageList, Composer, QuickReplies, HandoffForm, TicketConfirmation
  styles/widget.css     scoped styles; brand colours are CSS variables at the top
mock-gateway/server.js  fake gateway for local development
demo/                   pages that load the built dist/widget.js
```

## Next steps

- [ ] Real Chat Gateway (agent orchestration + HubSpot intake service)
- [ ] Portal token format agreed with VETTING dev team
- [ ] VETTING brand colours / logo
- [ ] "My cases" panel for client and candidate (`GET /cases`)
- [ ] Bot protection on public site
- [ ] Hosting for `widget.js` (CDN) and the gateway
