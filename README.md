# Fluently

An Anki-style spaced-repetition flashcard app for learning languages. You build
decks of cards, study the ones that are due, and rate how well you knew each
answer. An SM-2 scheduler decides when to show each card again, so you spend your
time on the material you're about to forget.

It's built on the [DeepSpace SDK](https://www.npmjs.com/package/deepspace) and
runs on Cloudflare Workers + Durable Objects. Auth, the database, real-time sync,
file storage, and the external-API proxy (LLM, text-to-speech, speech-to-text)
all come from the SDK.

## Features

- **Decks and deck management:** create, edit, and organize decks, each with an
  optional target and native language. Per-deck card counts (new, learning,
  review, due) and a daily cap on new and review cards.
- **SM-2 spaced repetition:** an SM-2 scheduler modeled on Anki, with learning
  and relearning steps, ease-factor adjustment, interval fuzz, leech detection,
  and per-deck setting overrides on top of global tuning.
- **Customizable card types and fields:** define card types with named fields
  (text, image, audio, or HTML), per-field side and required flags, reversible
  and cloze types, and front/back templates with CSS.
- **AI-assisted card generation:** generate cards in bulk from a prompt or a
  word list, with optional generated images and audio. Calls run through the
  DeepSpace integration proxy.
- **Anki `.apkg` import:** import existing Anki decks, including their note
  types, templates, and media, parsed from the `.apkg` package.
- **Vocabulary library:** browse a vocabulary dataset filtered by language,
  CEFR level, and part of speech, then add selected words as cards. Word lists
  can also be loaded on demand.
- **Pronunciation review:** a pronunciation card type that records your audio,
  transcribes it via speech-to-text, and returns an AI evaluation with a score
  and feedback. Reference pronunciation audio is sourced from Wiktionary.
- **Review and browse modes:** a focused review session for due cards with
  Again/Hard/Good/Easy ratings and live session counters, plus a browse mode for
  searching and editing the whole collection.
- **Theming:** built-in preset themes plus user-defined custom themes, with the
  active theme stored per user.
- **Real-time sync:** cards, decks, settings, and progress are stored in
  DeepSpace record collections and sync live across sessions.

## Tech stack

- **Frontend:** Vite + React 19 + Tailwind v4, TypeScript, file-based routing
  (generouted)
- **Backend:** a single Cloudflare Worker (Hono) + Durable Objects, via the
  DeepSpace SDK
- **AI and audio:** OpenAI for text and image generation, and a speech
  integration for text-to-speech and speech-to-text, all called through the
  DeepSpace integration proxy (Vercel AI SDK on the worker)
- **Data:** DeepSpace record collections with per-collection RBAC

## Getting started

### Prerequisites

- Node 20+
- A [DeepSpace](https://deep.space) account (free to sign in). The app uses
  DeepSpace for auth, data, file storage, and the integration proxy, and deploys
  to `<name>.app.space`.

### Run it locally

```sh
npm install
npx deepspace login        # one-time, opens a browser tab
npx deepspace dev          # http://localhost:5173
```

Sign in, create a deck, and start adding cards.

## Testing

```sh
npx deepspace test         # smoke, API, and end-to-end tests
```

The individual suites are available as `npx deepspace test smoke`,
`npx deepspace test api`, and `npx deepspace test e2e`. `npm run type-check`
runs `tsc --noEmit`.

## Deploy

```sh
npx deepspace deploy       # → <name>.app.space
```

The deploy subdomain is the `name` field in `wrangler.toml`. Rename it there for
your own deployment.

## Project structure

- `worker.ts`: the Cloudflare Worker (routes, auth proxy, integration proxy,
  AI chat, server actions, R2 file storage, and cron)
- `src/pages/`: file-based routes (home, app shell, catch-all)
- `src/components/app/`: the app's components (review and browse modes, card
  and deck editors, card-type and field editors, AI generation, Anki import,
  word library, pronunciation review, theme and settings panels)
- `src/schemas.ts` + `src/schemas/`: record collections and their RBAC
  (decks, cards, card types, settings, themes, daily progress, media)
- `src/utils/`: domain logic (SM-2 scheduling, Anki import, card and media
  storage, the field system, vocabulary dataset loading, themes, and prompts)
- `src/types.ts`: shared domain types (cards, decks, card types, scheduling,
  media, themes, settings)

`CLAUDE.md` in the parent workspace tells AI coding agents to load the DeepSpace
SDK skill before working here.

## License

MIT, see [LICENSE](LICENSE).

---

Built with [DeepSpace](https://deep.space).
