# 10-Year Sleep

A ten-year personal sleep project, presented in five-year chapters.
Ten years is a long horizon; five years feels like a meaningful milestone —
enough time to reveal a pattern, and a good moment to pause and look back.

## Repository layout

- `google-health-cli/` — exports Google Health sleep data with Go
- `sleep-map/` — static Next.js website
- `scripts/daily-sync.sh` — export, transform, and build pipeline
- `.github/workflows/sync-and-deploy.yml` — scheduled GitHub Pages deployment

## Local development

```bash
cd sleep-map
npm ci
npm run dev -- --hostname 0.0.0.0
```

## Local data sync

Create a local `.env` from `.env.example`, export its variables in your shell,
and keep `google-health-token.json` at the repository root.

```bash
./scripts/daily-sync.sh
```

Set `SKIP_SITE_BUILD=1` to update the data without rebuilding the website.

## GitHub Pages setup

Create these GitHub Actions repository secrets:

- `GOOGLE_HEALTH_CLIENT_ID`
- `GOOGLE_HEALTH_CLIENT_SECRET`
- `GOOGLE_HEALTH_TOKEN_JSON` — the complete contents of the local
  `google-health-token.json`

Then enable **Settings → Pages → Source → GitHub Actions**. The workflow:

1. runs daily at 19:17 Asia/Shanghai;
2. exports each available plan year from 2026 through the current year;
3. merges those yearly archives into one privacy-reduced public JSON;
4. builds a static site with the repository base path;
5. deploys the artifact to GitHub Pages.

Pushes to `main` deploy the committed public data without requiring OAuth
secrets. A manual workflow run performs a fresh sync before deployment.

Raw health exports, OAuth tokens, and local environment files are ignored and
must never be committed.
