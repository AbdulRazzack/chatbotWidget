# VETTING Chat Widget

One embeddable React chat widget used on all three VETTING sites, connected to **Microsoft Copilot Studio** agents.

| Site | Copilot Studio agent | Visitor login |
|---|---|---|
| Public website | **Public Agent Assistant** | None |
| Client portal | **Client Agent** | Portal login token |
| Candidate portal | **Candidate Support Assistant** | Portal login token |

All three front agents hand ticket requests to one backend agent, **VETTING Ticket Agent**, which creates the ticket in HubSpot.

```
                                   ┌─ Public Agent Assistant ─────┐
Website ─► Widget ─(Direct Line)─► ├─ Client Agent ───────────────┤ ─(connected agent)─► VETTING Ticket Agent ─► HubSpot
              │                    └─ Candidate Support Assistant ┘
              └─► Token server (this repo): checks the visitor's login, picks the agent,
                  and swaps that agent's secret key for a short-lived chat token
```

The browser never sees a secret key or a HubSpot token.

---

## Contents

1. [Requirements](#1-requirements)
2. [Quick start with the mock (no Microsoft account needed)](#2-quick-start-with-the-mock-no-microsoft-account-needed)
3. [Set up the agents in Copilot Studio](#3-set-up-the-agents-in-copilot-studio)
4. [Get the secret keys](#4-get-the-secret-keys)
5. [Fill in `.env`](#5-fill-in-env)
6. [Run against the real agents](#6-run-against-the-real-agents)
7. [Troubleshooting](#7-troubleshooting)
8. [Embedding on a website](#8-embedding-on-a-website)
9. [How it works](#9-how-it-works)

---

## 1. Requirements

- **Node.js 20.6 or newer** (check with `node -v`)
- Access to the Copilot Studio environment where the four agents live (currently **Confurmo** for testing)

```bash
git clone https://github.com/AbdulRazzack/chatbotWidget.git
cd chatbotWidget
npm install
```

---

## 2. Quick start with the mock (no Microsoft account needed)

The repo includes a fake Copilot Studio (`mock-copilot/`) so you can try the widget without any keys.

```bash
npm start
```

This starts two things:
- the **mock Copilot Studio** on http://localhost:8787
- the **widget dev page** on http://localhost:5173 (open this one)

Use the buttons at the top to switch between **Public site**, **Client portal** and **Candidate portal**.

Things to try:
- *"How long does a DBS check take?"* (Public)
- *"My check link has expired"* (Candidate)
- *"create a ticket for jane@test.com, I can't submit my DBS check"* (any)
- **Talk to a person**: fill in the form → you get a reference like `VET-1001`
- An email containing `fail` (e.g. `fail@test.com`) simulates HubSpot being down

The terminal shows the HubSpot ticket the Ticket Agent *would* create. The mock only recognises a few
keywords; anything else gets a placeholder reply.

---

## 3. Set up the agents in Copilot Studio

All four agents must be in the **same environment** and **published**.

Open https://copilotstudio.microsoft.com, check the environment picker (top right) shows the right
environment, then go to **Agents**.

### 3a. VETTING Ticket Agent (do this first)

1. Open **VETTING Ticket Agent** → **Settings** → turn on **Let other agents connect to and use this one**.
2. On the agent's main page, add this to the **Instructions**:
   > When another agent sends you a request, it will include the person's name, email, category
   > (Candidate, Client or Referee), region and issue. Use those values exactly as given; never guess
   > the category. Always reply with "Ticket created: <ticket ID>" or "Ticket failed: <reason>".
3. **Publish**.

> If the front agents later reply but the ticket step fails with "no access", also give the Ticket Agent
> the settings in steps 3b-2 and 3b-3 below (remove Work IQ, No authentication, Require secured access)
> and publish it again. **Don't copy its secret anywhere**: visitors should only reach it through
> the front agents.

### 3b. Each front agent: Public Agent Assistant, Client Agent, Candidate Support Assistant

Repeat these steps for all three.

**1. Connect it to the Ticket Agent**
1. Open the agent → **Agents** → **Add an agent**.
2. Under **Connect to an external agent**, choose **Copilot Studio** → **VETTING Ticket Agent**.
3. Description: *"Use only when the user needs a human: creating, finding or updating a support ticket."*
4. Untick **Pass conversation history to this agent** (keeps candidate chat details private).
5. Add to this agent's **Instructions** (change the category line per agent):
   > When the user asks for a person or a ticket, or sends a message starting "Please create a support
   > ticket", pass the name, email, region and issue to the VETTING Ticket Agent with
   > category = **Candidate** *(Candidate Support Assistant)* / **Client** *(Client Agent)* /
   > *the "I am a" value, asking if it's missing (Public Agent Assistant)*.
   > Then repeat its reply line "Ticket created: <ID>" or "Ticket failed: <reason>" word for word.

   The widget looks for that "Ticket created: <ID>" line to show its confirmation screen.

**2. Remove Work IQ**
1. On the agent's main page (Instructions / Knowledge / Tools), find **Work IQ**.
2. Click **✕** (or **⋯ → Remove**) → **Save**.

Work IQ gives the agent access to your organisation's Microsoft 365 data, and it forces Microsoft
sign-in, which website visitors can't do. While you're here, also check **Search all websites** is off
under Knowledge unless you want web answers.

**3. Turn off Microsoft sign-in**
1. **Settings → Security → Authentication**.
2. Choose **No authentication** → **Save**.

This is safe because **Require secured access** (next section) means only our token server, which holds
the secret key, can start a chat. Client/candidate identity is checked by the token server.

**4. Publish** the agent. The website only ever uses the latest published version.

---

## 4. Get the secret keys

Each front agent has its own secret key. You need three: Public, Client, Candidate.

For each front agent:

1. Open the agent → **Settings** → **Security** → **Web channel security**.
2. Turn on **Require secured access**.
   (This can take **up to two hours** to fully apply. Until then the agent may still answer without a key.)
3. You'll see **Secret 1** and **Secret 2**. Click **Copy** next to **Secret 1**.
   (Either works; Secret 2 lets you swap keys later without downtime.)
4. Paste it into `.env` (next section).

The Ticket Agent doesn't need a key in `.env`.

> **Keep the keys secret.** Anyone with a key can talk to that agent. Don't paste them into Teams,
> Jira, screenshots or commits. `.env` is in `.gitignore`, so git won't upload it.
> If a key leaks, click **Regenerate** on that page and update `.env`.

---

## 5. Fill in `.env`

```bash
cp .env.example .env
```

Open `.env` and fill it in. **No quotes, no angle brackets, no spaces around `=`.**

```ini
PORT=8787

# Secret 1 from each front agent (section 4)
DIRECTLINE_SECRET_PUBLIC=paste-public-agent-assistant-secret-here
DIRECTLINE_SECRET_CLIENT=paste-client-agent-secret-here
DIRECTLINE_SECRET_CANDIDATE=paste-candidate-support-assistant-secret-here

# Direct Line address for the environment's region (Europe by default)
DIRECTLINE_DOMAIN=https://europe.directline.botframework.com/v3/directline

# LOCAL TESTING ONLY: lets the dev page's Client/Candidate buttons log in with fake test logins
DEV_TEST_LOGINS=true
```

| Setting | What it is | Where it comes from |
|---|---|---|
| `DIRECTLINE_SECRET_PUBLIC` | Key for **Public Agent Assistant** | Section 4 |
| `DIRECTLINE_SECRET_CLIENT` | Key for **Client Agent** | Section 4 |
| `DIRECTLINE_SECRET_CANDIDATE` | Key for **Candidate Support Assistant** | Section 4 |
| `DIRECTLINE_DOMAIN` | Microsoft's Direct Line address | Leave as is; see Troubleshooting if keys are rejected |
| `DEV_TEST_LOGINS` | Accept fake client/candidate logins | `true` locally, **never in production** |
| `ALLOWED_ORIGINS` | Websites allowed to use the token server | Production only, e.g. `https://www.vetting.com` |
| `PORTAL_JWKS_URL`, `PORTAL_ISSUER`, `PORTAL_AUDIENCE`, `PORTAL_ROLE_CLAIM` | How to check real portal logins | From VETTING's dev team (production only) |

---

## 6. Run against the real agents

```bash
npm run start:real
```

This starts the **token server** (using your `.env`) and the **dev page**. Open http://localhost:5173.

1. Click **Public site** → ask *"I'm a referee, what do I need to do?"*. You should get a real answer.
2. Click **Talk to a person** → choose **Referee** → use a test email (e.g. `ref@test.com`) → send.
   You should see *"Ticket created: …"* in the chat, then the confirmation screen.
3. Check your HubSpot test account: new ticket in **Support Pipeline → New**, **Source = Chat**,
   **Category = Referee**, linked to the contact.
4. Repeat with **Candidate portal** and **Client portal** (category should be Candidate / Client).

Use **test data only**, never real candidate details.

### Test the built bundle (how a real site loads it)

```bash
npm run build           # creates dist/widget.js
npm run token-server    # terminal 1 (or `npm run mock` for the mock)
npx serve .             # terminal 2 → http://localhost:3000/demo/public.html
```

---

## 7. Troubleshooting

| What you see | Cause | Fix |
|---|---|---|
| **"You don't have access to talk to this bot, contact the owner."** | Agent still requires Microsoft sign-in | Section 3b steps 2-4: remove Work IQ, set **No authentication**, **publish**, wait a few minutes, open a new chat |
| **"No authentication unavailable … Remove Work IQ"** | Work IQ still added to the agent | Remove Work IQ (3b step 2), then try again |
| **"We couldn't connect to support right now"** in the widget | Token server not running, or it failed | Check the `npm run start:real` terminal for errors |
| Terminal: **`Missing required env var DIRECTLINE_SECRET_…`** | `.env` missing a key | Fill in all three secrets (section 5) |
| Terminal: **`Direct Line token generation failed 401` / `403`** | Wrong key, or wrong region | Re-copy **Secret 1**; if still failing set `DIRECTLINE_DOMAIN=https://directline.botframework.com/v3/directline` |
| Client/Candidate buttons → **401 Invalid portal token** | Test logins not enabled | Set `DEV_TEST_LOGINS=true` in `.env` and restart |
| Agent says it created a ticket but **no confirmation screen** | Reply didn't include the ticket number | Tighten the "repeat 'Ticket created: <ID>' word for word" instruction (3b step 1.5), publish |
| Ticket step says **no access** | Ticket Agent still requires sign-in | See the note under 3a |
| Changes in Copilot Studio **don't show up** | Old published version | **Publish** again and open a **new** chat |
| `node: bad option: --env-file` | Node too old | Install Node 20.6+ |
| **Port already in use** | Something still running | Ctrl + C in the old terminal |
| Dev page in **Comic Sans** | Deliberate | Proves the website's styles can't affect the widget |

---

## 8. Embedding on a website

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
| `data-audience` / `audience` | `public` \| `client` \| `candidate` | A hint only; the token server decides the real audience from the login |
| `data-region` / `region` | `UK` \| `AU` | Sent to the agent; maps to HubSpot "AU / UK Prod" |
| `data-token-url` / `tokenUrl` | URL | Defaults to `http://localhost:8787/token` |
| `data-start-open` / `startOpen` | `true` | Open on load |
| `data-manual-init` | `true` | Don't auto-start; call `VettingChat.init()` yourself |
| `authToken` (JS only) | string | Portal login token |

JS API: `window.VettingChat.init(options)`, `window.VettingChat.destroy()`.

**Going live** also needs: real portal-token settings instead of `DEV_TEST_LOGINS`, `ALLOWED_ORIGINS`
set, the token server deployed behind HTTPS (e.g. Azure App Service), and `widget.js` hosted on a CDN.

---

## 9. How it works

**Token server (`server/token-server.js`)**: `POST /token`, optionally with `Authorization: Bearer <portal token>`:
- no login → Public agent; valid client/candidate login → that agent; forged login → `401`
- swaps that agent's secret for a short-lived Direct Line token and returns
  `{ token, domain, userId, audience, authenticated, webSocket }`

**Widget → agent**: normal chat messages over Direct Line. The **Talk to a person** form is sent as a
chat message too:

```
Please create a support ticket for me.
Name: Jane Test
Email: jane007@test.com
I am a: referee          ← public site only
Region: UK
Issue: Cannot submit my DBS Enhanced application
```

**Agent → widget**: a reply containing `Ticket created: <ID>` shows the confirmation screen;
`Ticket failed` shows the support-email fallback. If the agent asks a follow-up question, the visitor
answers in chat. Full details for agent builders: **[COPILOT_STUDIO.md](COPILOT_STUDIO.md)**.

### Security rules
- Secret keys live only in the token server's `.env`; the HubSpot key only in the Ticket Agent's workflows.
- **Require secured access** on every agent, so knowing an agent's ID isn't enough to reach it.
- The token server decides who the visitor is from the **verified** login, never from `data-audience`.
- "Ticket logged" is shown only when the agent replies with a real ticket number.
- Agent replies are rendered as text (small safe markdown subset; no HTML).
- Agents never ask for passwords, ID images or criminal-record details, and never make suitability decisions.

### Project structure

```
src/
  main.tsx                 loader: data-* attrs → Shadow DOM → window.VettingChat
  App.tsx                  launcher + window
  config/audiences.ts      per-audience greeting, quick replies, labels
  api/tokenClient.ts       calls the token server
  hooks/useConversation.ts Direct Line connection, messages, typing, ticket detection
  components/              Launcher, ChatWindow, MessageList, RichText, Composer, QuickReplies, HandoffForm, TicketConfirmation
  styles/widget.css        scoped styles; brand colours are CSS variables at the top
server/token-server.js     token server (real agents)
mock-copilot/server.js     local mock: token server + Direct Line + 3 agents + ticket agent
demo/                      pages loading the built dist/widget.js
COPILOT_STUDIO.md          what the agent builders must set up
```

### Commands

| Command | What it does |
|---|---|
| `npm start` | Mock Copilot Studio + dev page |
| `npm run start:real` | Token server (real agents, needs `.env`) + dev page |
| `npm run mock` | Mock only |
| `npm run token-server` | Token server only |
| `npm run dev` | Dev page only |
| `npm run build` | Typecheck + build `dist/widget.js` |
