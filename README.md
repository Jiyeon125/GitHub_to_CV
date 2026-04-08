# GitHub Developer Activity Report PoC

Minimal Next.js + TypeScript proof-of-concept for validating stage 1 of a GitHub activity report service.

## What this PoC does

- Accepts a GitHub username.
- Calls `/api/analyze`.
- Fetches public profile and repositories from GitHub REST API.
- Applies explicit rule-based repository scoring.
- Shows top 3 representative repositories.
- Shows compact summary including top language and README checks.
- Handles loading, empty, and error states.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Optional: set a token for higher rate limits:

```bash
export GITHUB_TOKEN=your_token_here
```

3. Run the app:

```bash
npm run dev
```

4. Open http://localhost:3000

## Sample usernames

- `torvalds`
- `gaearon`
- `yyx990803`
- `sindresorhus`

## Notes

- If `GITHUB_TOKEN` is missing, the API still works but may hit stricter rate limits.
- This intentionally excludes auth, persistence, charts, exports, and LLM summarization.
