# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run all Jest tests
npm run test:memory  # Memory system tests only
npm run test:batch   # Batch tests with categories
npm run test:regression  # Regression tests
```

To run a single test file:
```bash
npx jest path/to/file.test.ts --no-coverage
```

## Architecture

This is a Chinese AI companion system — users chat with one of several distinct AI personas that maintain long-term memory across sessions.

**Request flow:**
1. `POST /api/chat` receives `{ message, persona_id, session_id }`
2. `src/lib/memory/` retrieves relevant memories + user profile via `MemoryGateway`
3. `src/lib/ai/prompt-templates.ts` builds the system prompt injecting persona identity + memory context
4. Claude API generates a reply
5. Post-processing enforces persona identity rules (`src/lib/persona/`)
6. `maybeRefreshSessionMemory()` asynchronously extracts and persists new memories

**Memory system (`src/lib/memory/`):**
- `MemoryGateway` — abstract interface; `Mem0Adapter` is the concrete implementation
- Embeddings stored in Supabase with pgvector (1536-dim); pluggable providers: OpenAI, NVIDIA, or local fallback
- Reranking via Jina or local fallback
- Chinese referential resolution detects cues like 还记得/上次/那个 to anchor memory lookups
- Memory context is cached per `sessionId + messageCount`

**Key lib modules:**
- `src/lib/ai/` — Claude client, prompt building, post-processing, prompt version management
- `src/lib/memory/` — MemoryGateway, Mem0Adapter, embedding/reranking services
- `src/lib/chat/` — session and message CRUD
- `src/lib/persona/` — identity rules, canonical identity enforcement
- `src/lib/supabase/` — typed DB client (`types.ts` is the single source of DB types)

**Database tables:** `profiles`, `personas`, `sessions`, `messages`, `memories`, `user_profiles_per_persona`, `evaluation_logs`

## Conventions

- All prompt templates live in `src/lib/ai/prompt-templates.ts` — do not scatter prompts elsewhere
- All DB types defined in `src/lib/supabase/types.ts`
- API routes return `{ success: boolean, data?, error? }`
- File names: kebab-case. Exports: PascalCase (components), camelCase (functions)
- Use `async/await`, not `.then()`
- Tailwind CSS v4 — syntax differs from v3; check docs before using new utilities

## Environment Variables

Required in `.env.local`:
```
ANTHROPIC_AUTH_TOKEN=
ANTHROPIC_MODEL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MEMORY_PROVIDER=mem0
MEM0_API_KEY=
```

Optional:
```
EMBEDDING_PROVIDER=openai|nvidia   # defaults to local fallback
EMBEDDING_API_KEY=
RERANKER_PROVIDER=jina
RERANKER_API_KEY=
```

## Supabase / Database

Migrations are in `supabase/migrations/` (run in order 001→004). Seed data (3 personas: 小晚, 阿杰, 大力) is in `supabase/seed.sql`.

pgvector extension is required — see `002_enable_pgvector.sql`.
