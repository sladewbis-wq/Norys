# Norys OpenUI — Frontend

The **OpenUI layer** of Norys: a modern, premium, dark-mode control center for
the sovereign enterprise AI platform. Built for non-technical users — a calm
"AI command center" inspired by Linear, Notion, Raycast, Anthropic and Claude
Desktop. Talks to the **Norys Core** backend API.

## Stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · lucide-react.

## Features (MVP)

- **Auth** — login + self-service organisation signup (creates a tenant + owner).
  JWT access/refresh tokens with transparent refresh.
- **Cockpit** — dashboard with stats, helpdesk spotlight and the agent library.
- **Assistants (chat)** — conversation list, agent-scoped threads, **streaming**
  replies over SSE, optimistic UI.
- **Agents** — cards + guided editor (system prompt, provider/model, temperature,
  RAG toggle, human-approval toggle). Create/edit/delete gated by role.
- **Documents** — upload + listing for the private RAG base with status badges.
- **Administration** — user management with role assignment + the audit log
  viewer. Visible only to owners/admins.

## Design system

Defined in `tailwind.config.ts` + `globals.css`:
near-black warm surfaces, an indigo brand accent, soft shadows, thin scrollbars,
subtle fade-in motion. All colors are tokens (`bg`, `border`, `content`, `brand`).

## Structure

```
src/
  app/
    layout.tsx              root layout + AuthProvider
    page.tsx                redirect entrypoint
    login/  register/       auth screens
    (app)/                  authenticated shell (sidebar + guard)
      layout.tsx
      cockpit/  chat/  agents/  documents/  admin/
  components/               ui primitives, sidebar, modal, page-header, agent-editor
  lib/                      api client, types, auth context, utils
```

## Run locally

```bash
npm install
cp .env.example .env.local        # point NORYS_API_BASE at Norys Core
npm run dev                        # http://localhost:3000
```

API calls to `/api/*` are proxied to `NORYS_API_BASE` (default
`http://localhost:8000`) via `next.config.mjs` rewrites, so there are no CORS
issues in development.

## Build / Docker

```bash
npm run build && npm start
# or
docker build -t norys-openui . && docker run -p 3000:3000 norys-openui
```

The image uses Next.js `standalone` output for a small production runtime.

## Notes

- The API client (`src/lib/api.ts`) mirrors the Norys Core schemas one-to-one;
  update both together when the contract changes.
- Tokens live in `localStorage` for the MVP; move to httpOnly cookies for a
  hardened production deployment.
