# iSAQB CPSA-F Mock Exam

A web-based practice exam for the **iSAQB Certified Professional for Software Architecture — Foundation Level (CPSA-F)**.

Questions are sourced from the [official iSAQB examination question catalog](https://github.com/isaqb-org/foundation-exam-questions).

## Take the exam

You can take the exam [here](https://enyineer.github.io/isaqb-exam/). Please report any issues in this repositories issue tracker.

## Features

- 🎯 Pick & category question types with iSAQB scoring rules
- 🔀 Shuffled answer order per attempt to prevent pattern memorization
- ⏱️ Active time tracking (pauses when browser is closed)
- 💾 Auto-saves progress to localStorage — refresh without losing state
- 🚩 Flag questions for review — confirmation prompt before finishing with flagged questions
- 📝 Per-question notes for your lecturer — persisted and shown in results + print
- 🖨️ Print/export results for your lecturer (including notes)
- 🔵 Skipped vs wrong answer distinction in results (no penalty for skipped)
- 🏆 Leaderboard — submit scores via OAuth, verified server-side by a Cloudflare Worker
- 🛡️ Admin panel — manage leaderboard entries, block users, and add/remove administrators
- 🎓 Exam sessions — lecturers create timed sessions, share via link/QR, view submissions and per-question statistics
- 🌍 German & English
- 🎨 Multiple color themes + dark mode
- ⌨️ Full keyboard navigation
- 🔗 Hash-based routing — works on GitHub Pages without server config

## Architecture

- [Leaderboard Architecture](leaderboard-architecture.md) — sequence diagrams, data model, authentication, and Worker secrets
- [Admin Interface](admin-interface.md) — access control, features, API endpoints, and setup
- [Session Management](session-management.md) — timed exam sessions, participant flow, statistics, and deployment

## Tech Stack

React 19 · Vite · Tailwind CSS v4 · Bun · TypeScript · Wouter

## Getting Started

```bash
bun install
bun run dev
```

This starts the frontend only. Questions and leaderboard data are served from the production Worker.

### Full-Stack Local Development

To run both the frontend and the Cloudflare Worker locally:

1. **Install dependencies** for both frontend and worker:
   ```bash
   bun install
   cd worker && bun install
   ```

2. **Configure worker secrets** — copy the template and fill in your credentials:
   ```bash
   cp worker/.dev.vars.example worker/.dev.vars
   ```
   Edit `worker/.dev.vars` with your GitHub PAT, OAuth app credentials, JWT secret, and initial admin user IDs.

   > **Admin access:** Set `ADMIN_USER_IDS` to a comma-separated list of user IDs (e.g. `google:123,github:456`) to grant initial admin privileges. See [admin-interface.md](admin-interface.md) for details.

3. **Set up OAuth apps for local testing** — register these in your GitHub/Google OAuth apps:
   - **Authorized JavaScript origins:** `http://localhost:8787`
   - **Authorized redirect URIs:**
     - `http://localhost:8787/auth/github/callback`
     - `http://localhost:8787/auth/google/callback`

4. **Start both servers:**
   ```bash
   bun run dev:all
   ```
   - Frontend: `http://localhost:5173/isaqb-exam/`
   - Worker: `http://localhost:8787`

   The worker runs with local KV storage — no data is written to production.

### Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start frontend only |
| `bun run dev:worker` | Start worker only (local KV) |
| `bun run dev:all` | Start both frontend + worker |
| `bun run build` | Production build |
| `bun test` | Run tests |

## Testing

```bash
bun test
```

## Disclaimer

This tool and its author are not affiliated with [iSAQB e.V.](https://www.isaqb.org/)
No guarantee is provided for the correctness of the questions or the test itself.

## License

[MIT](LICENSE.md)
