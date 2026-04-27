# cusor_hack_london_2026_1

Workspace for the Cursor hackathon board, submission manager, judging flow, and supporting artifacts.

## Folders

- `guild-bounty-board`: live Vercel-deployed board, admin manager, and judge portal
- `cursor-hackathon-hcmc-2025`: analyzer toolkit and related event scripts
- `artifacts`: hackathon briefs and supporting docs
- `scripts`: helper scripts for publishing admin snapshots

## Environment variables

Two deploy surfaces:

1. **Guild board + serverless APIs** (`guild-bounty-board` on Vercel): copy `guild-bounty-board/.env.example` to `guild-bounty-board/.env.local` and fill values, or set them in the Vercel project. Covers judge portal (`SITE_PASSWORD`, `AUTH_SECRET`), Supabase (`SUPABASE_*`), and optional `GITHUB_TOKEN` / `OPENCODE_API_KEY`.

2. **Cursor credits (Next.js)** (`guild-bounty-board/credits-portal`, proxied from the main app as `/credits/*`): copy `guild-bounty-board/credits-portal/env.example` to `guild-bounty-board/credits-portal/.env.local` for Firebase + `ADMIN_PASSWORD`.

**Repo scripts** (`scripts/build_bounties_opencode.mjs`): optional `OPENCODE_API_KEY`, `OPENCODE_CHAT_COMPLETIONS_URL`, `X_BEARER_TOKEN` when generating bounties.