# Exam Session Management

Lecturers can create **timed exam sessions**, share them via link or QR code, and review detailed submission results and per-question statistics.

## Overview

Unlike the self-serve practice mode (where anyone can take the exam and optionally submit to the leaderboard), sessions are:

- **Time-gated** — participants can only submit within a defined start/end window
- **Lecturer-owned** — only the creator can view results, stats, and participant notes
- **Server-side scored** — participants send raw answers; the Worker scores them using the same `scoreExam()` function as the leaderboard, preventing client-side tampering
- **Version-pinned** — each session is locked to a specific question `commitSha`, so all participants answer the same set of questions

## User Flows

```
┌─────────────┐     creates      ┌──────────────┐     shares link/QR      ┌─────────────────┐
│   Lecturer   │ ──────────────▶ │   Session     │ ──────────────────────▶ │   Participant    │
│  (authed)    │                 │  (KV stored)  │                         │ (OAuth/nickname) │
└──────┬───────┘                 └───────┬───────┘                         └────────┬─────────┘
       │                                 │                                          │
       │  views submissions              │  within time window                      │  takes exam
       │  views statistics               │                                          │  submits answers
       │  exports CSV                    │                                          │
       ▼                                 ▼                                          ▼
┌──────────────┐              ┌───────────────────┐                     ┌────────────────────┐
│ Session      │              │  Server-side       │                     │ Standard exam flow │
│ Detail Page  │◀─────────────│  scoring via       │◀────────────────────│ (reuses ExamContext │
│ (owner only) │              │  scoreExam()       │   raw answers       │  QuestionPage etc) │
└──────────────┘              └───────────────────┘                     └────────────────────┘
```

---

## Pages

### 1. Session Dashboard (`/#/sessions`)

Authenticated lecturers manage all their sessions from this page. Each session card shows:

- **Title** and optional **description**
- **Time window** (start → end)
- **Status badge**: 🟢 Active · 🟡 Upcoming · 🔴 Ended
- **Session link** with click-to-copy and **delete** button

Clicking **"Create Session"** opens an inline form:

| Field | Description |
|-------|-------------|
| Title | Session name (required) |
| Description | Optional description shown to participants |
| Slug | Optional human-readable URL (e.g. `isaqb-march-2026`) |
| Start / End time | Time window within which participants can submit |

The session is automatically pinned to the current question version.

### 2. Session Detail (`/#/sessions/:id`)

Only accessible to the session creator. Two tabs:

#### Submissions Tab

- Participant list with avatar, name, auth method (🐙 GitHub / 🔵 Google / 👤 Nickname), score, pass/fail, time
- Expandable rows showing score breakdown and participant notes
- **CSV export** for all submissions
- **Auto-refresh** every 30 seconds for active sessions

#### Statistics Tab

- **Pass rate donut chart** (SVG) with total submissions and average score
- **Per-question cards** (expandable, with expand/collapse all):
  - **Pick questions**: Horizontal bar chart per option (correct highlighted green, incorrect red). Invalid submissions (too many options selected) shown separately.
  - **Category questions**: Card grid showing how participants assigned each statement to each category. Correct assignments highlighted.
  - **Time box-plot**: p10 / p25 / median / p75 / p90 visualization
  - **Participant notes**: All notes for that question with author attribution

**Additional features in the header:**
- **Shareable link** with copy button
- **QR code** (pure SVG, no external dependency) for projection in lecture halls
- **Edit** session metadata inline
- **Delete** with confirmation modal

### 3. Participant Entry (`/#/session/:idOrSlug`)

When a participant opens a session link:

| Session Status | Behavior |
|----------------|----------|
| **Upcoming** | Shows session info + live countdown timer |
| **Active** | Shows auth options: nickname input ("Join as Guest") or OAuth sign-in |
| **Ended** | Shows "Session has ended" message |

After authenticating, the standard exam flow begins (same question pages, timer, note-taking). On completion, raw answers are submitted and **scored server-side**.

Duplicate submissions are prevented (one per participant per session).

Session links support both UUID and slug-based URLs:
- `/#/session/a1b2c3d4-...`
- `/#/session/isaqb-march-2026`

---

## Data Model (Cloudflare KV)

Sessions use the `EXAM_SESSIONS` KV namespace:

| Key Pattern | Value | Description |
|-------------|-------|-------------|
| `session:{id}` | `ExamSession` JSON | Session metadata (creator, time window, commit SHA) |
| `session:{id}:submissions` | `SessionSubmission[]` JSON | All participant submissions |
| `sessions-by-user:{userId}` | `string[]` JSON | Index of session IDs per user |
| `session-slug:{slug}` | `string` (session ID) | Slug → ID lookup for human-readable URLs |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/sessions` | Required | Create session |
| `GET` | `/api/sessions` | Required | List user's sessions |
| `GET` | `/api/sessions/:idOrSlug` | Public | Get session details (supports ID or slug) |
| `PUT` | `/api/sessions/:id` | Owner | Update session |
| `DELETE` | `/api/sessions/:id` | Owner | Delete session + all data |
| `POST` | `/api/sessions/:idOrSlug/submit` | OAuth / Nickname | Submit exam answers |
| `GET` | `/api/sessions/:id/submissions` | Owner | List all submissions |
| `GET` | `/api/sessions/:id/stats` | Owner | Aggregated per-question statistics |

## Key Design Decisions

1. **Server-side scoring only**: Participants send raw answers — the Worker fetches questions at the session's `commitSha` and scores them. This prevents client-side score manipulation and ensures consistency with leaderboard scoring.

2. **Slug-based URLs**: Optional human-readable slugs with uniqueness enforcement via a dedicated KV index. The Worker transparently resolves both UUIDs and slugs.

3. **No charting library**: All visualizations (pass rate donut, answer distribution bars, time box-plots) use pure CSS/SVG, keeping the bundle lean.

4. **Session context via `sessionStorage`**: The exam flow reuses `ExamContext` and existing question pages. A `SessionContext` stored in `sessionStorage` tells `ResultsPage` to submit to the session endpoint instead of the leaderboard.

5. **QR code**: Pure client-side SVG generation with no external dependency — designed for easy sharing via projector in lecture halls.

## Shared Code

The session feature follows the same DRY patterns as the rest of the codebase:

| Module | Shared Between |
|--------|----------------|
| `src/data/sessionSchema.ts` (Zod schemas) | Frontend + Worker |
| `src/utils/scoring.ts` (`scoreExam()`) | Leaderboard + Sessions |
| `worker/src/questions.ts` (`fetchQuestionsAtCommit()`) | Leaderboard + Sessions |
| `worker/src/auth.ts` (`getSession()`) | All authenticated endpoints |

## Deployment

A new KV namespace must be created before deploying:

```bash
cd worker && npx wrangler kv namespace create EXAM_SESSIONS
```

Update the binding ID in `worker/wrangler.toml` with the output from the command above.
