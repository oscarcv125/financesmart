# FinanceSmart — Project Guide for Claude

> Read this first when starting a new session in this repo.

## What this is
Spanish-language financial assistant (web app). Users see a dashboard with their finances and chat with **Fortia AI** — an agentic chatbot that answers questions, surfaces insights, and proposes write-actions (aporte a meta, crear presupuesto, etc.) that the user confirms before they execute.

## Stack
- **Frontend**: React 19 + Vite 7. Entry `frontend/src/`. Deployed to Vercel as a SPA.
- **Backend**: Express 5 on Node. Entry `backend/app.js`. Deployed on Vercel via `api/index.js` adapter.
- **Database**: Supabase (Postgres + Auth + RLS).
- **LLM**: Gemini 2.5 Flash (production default) with Ollama (`qwen2.5:7b`) as offline fallback. Selected via `AI_PROVIDER` env in `backend/utils/aiProvider.js`.

## Layout
```
frontend/                React SPA
  src/components/        Chatbot.jsx is the big one (~2000 LOC, 11 widget renderers)
  src/styles/            chatbot.css holds widget styling
  vite.config.js         Code-split: recharts/markdown/supabase pulled out of main bundle

backend/
  app.js                 Express setup, route mounting, rate limits
  routes/                One file per resource. `chatbot.js` is the agent route.
  utils/
    aiProvider.js        Selects Gemini vs Ollama by env
    providers/           gemini.js, ollama.js — both export the same shape
    agent/
      loop.js            Agent loop: tool execution, redundancy detection, history compaction
      grounding.js       System prompt guardrails (parameterized by user name)
      proposalStore.js   In-memory TTL store for write-action proposals
    tools/
      index.js           Registry builder
      context.js         Per-request id Sets/Maps for validation
      schemas.js         Zod schemas + ISO-date refine + tool descriptions
      readTools.js       9 read tools wrapping route fns
      writeTools.js      5 write tools — never mutate, only emit proposals
    auditLog.js          Append-only log of executed write actions
    logger.js            JSON-line structured logger
  services/
    proactiveInsightsService.js  LLM-summarized insights, 6h cache (memory + Postgres)
  schemas/
    chatbotResponse.js   Zod envelope for structured output
  scripts/
    seed-sofia.js        Demo fixture: Sofia user with 12 months of realistic data
  migrations/            SQL files (003_audit_log, 004_proactive_insights_cache, ...)
  __tests__/             Jest. 181+ tests. Helpers in __tests__/helpers/
  regression/            64+ prompts run against real Gemini. `npm run regression`.
```

## Common commands
```bash
# Backend dev
cd backend && npm start                    # node server.js
cd backend && npm test                     # jest
cd backend && npm run regression           # full prompt suite vs Gemini
cd backend && npm run prompt-sheet         # generate printable HTML/PDF

# Frontend dev
cd frontend && npm run dev                 # vite
cd frontend && npm run build               # production build

# Seed Sofia (demo fixture)
cd backend && node scripts/seed-sofia.js
```

## Environment variables
- `GEMINI_API_KEY` — required for production chatbot path
- `GEMINI_MODEL` — default `gemini-2.5-flash`
- `GEMINI_TIMEOUT_MS` — default 90000
- `GEMINI_THINKING_BUDGET` — default 0 (no extended thinking)
- `OLLAMA_HOST` — default `http://localhost:11434`
- `OLLAMA_MODEL` — default `qwen2.5:7b`
- `OLLAMA_TIMEOUT_MS` — default 120000
- `AI_PROVIDER` — `gemini` (default) | `ollama`
- `LOG_LEVEL` — `debug|info|warn|error`, default `info`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — server-side
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — client-side

## Conventions
- **Spanish-first**: all user-facing strings in Spanish. The system prompt explicitly forbids switching languages.
- **Per-request enum guards**: every ID-bearing tool argument is validated against a Set built from the user's actual rows (`tools/context.js`). Hallucinated IDs are rejected before any DB call.
- **Write actions never mutate directly**: write tools emit proposals to an in-memory store. Mutation happens only in `/api/chatbot/confirm-action` after re-validation with the same zod schema.
- **Capability branching**: chatbot route checks `aiProvider.capabilities.supportsTools` and either runs the agent loop (Gemini) or falls back to context-injection streaming (Ollama).
- **No regex-parsed widgets**: we use a single zod-validated JSON envelope (`schemas/chatbotResponse.js`). The 11 frontend `Inline*` widgets receive typed props.

## Gotchas
- Express 5 + Vercel: use `res.on('close')` not `req.on('close')` to detect client disconnect (Express 5 fires `req.on('close')` immediately after the body finishes).
- Zod v4: use built-in `z.toJSONSchema()` — `zod-to-json-schema@3` is incompatible.
- Gemini schema converter: `zodToGeminiSchema` strips `const`, `propertyNames`, `additionalProperties`, `$schema`, and converts `oneOf` of object variants. Do NOT pass raw zod-to-json-schema output to Gemini.
- The agent loop uses `generateStreamWithTools` when `onTextDelta` is provided so users see real token streaming on the final reply turn.
- `materializar` (recurrencias) only runs on explicit `materialize:true` calls (the `GET /api/recurrencias` route). Agent reads pass `materialize:false` to keep chatbot turns side-effect-free.
- `proposalStore` is in-memory; survives only one Vercel function instance. Confirm-action across cold starts will return `NOT_FOUND` — acceptable given 10-min TTL.

## Don't
- Don't add features that aren't asked for.
- Don't write multi-paragraph comments. Default to none. Only WHY when non-obvious.
- Don't add fallback/error handling for cases that can't happen.
- Don't commit secrets. `.env*` are gitignored except `.env.example`.
- Don't bypass guardrails. If a tool seems "stuck", read the redundancy detector and grounding prompt before patching the model output.

## Where to look first
- New chatbot bug? `backend/routes/chatbot.js` (route) + `backend/utils/agent/loop.js` (loop).
- New widget? `frontend/src/components/Chatbot.jsx` (renderer) + `backend/routes/chatbot.js` (extractor) + `backend/utils/agent/grounding.js` (prompt instructions).
- Tool fabrication? `backend/utils/tools/schemas.js` (per-request enums) + `backend/utils/tools/context.js`.
- Hallucination probe failing? `backend/regression/prompts.json` + `backend/regression/expectedAnswers.js`.
