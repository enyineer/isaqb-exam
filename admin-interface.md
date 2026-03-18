# Admin Interface

The admin interface provides tools for managing leaderboard entries, users, and administrators. Access it at [`/#/admin`](/#/admin).

## Access Control

Admin access is gated by a two-tier system:

1. **Seed admins** — defined via the `ADMIN_USER_IDS` Worker secret (comma-separated user IDs like `google:123,github:456`). These cannot be removed at runtime.
2. **Dynamic admins** — added or removed through the admin UI itself. Stored in Cloudflare KV as `{id, name}` objects for easy identification.

Any authenticated user can view their own user ID on the access-denied page, making it easy to share with an existing admin for provisioning.

## Features

### Leaderboard Entry Management

- View all leaderboard submissions across all question versions
- **Delete entries** — remove individual entries by user + commit SHA (with confirmation modal)
- Entries display user ID, display name, avatar, score, percentage, time, and submission date

### User Blocking

- View the list of currently blocked users
- **Block users** — banned users cannot submit new leaderboard entries (confirmation required)
- **Unblock users** — re-enable leaderboard access for a user

### Administrator Management

- View all administrators (seed + dynamic) with visual distinction:
  - 🟡 **Seed** — from `ADMIN_USER_IDS` secret, cannot be removed
  - 🔵 **Dynamic** — added via the UI, removable
- **Add admin** — provide a user ID and an optional display name for identification
- **Remove admin** — revoke dynamic admin privileges (confirmation required)

## Authentication Error Handling

If OAuth authentication fails at any stage (missing code, invalid state, token exchange failure, user info fetch error), the worker redirects to `/#/auth-error` which shows a dedicated error page with retry options.

## Worker API Endpoints

All admin endpoints require a valid JWT from an admin user.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/check` | Check if current user is an admin |
| `GET` | `/api/admin/leaderboard/entries` | List all leaderboard entries (includes user IDs) |
| `DELETE` | `/api/admin/leaderboard/entry` | Delete an entry by `{userId, commitSha}` |
| `GET` | `/api/admin/leaderboard/blocked` | List blocked user IDs |
| `POST` | `/api/admin/leaderboard/blocked` | Block a user `{userId}` |
| `DELETE` | `/api/admin/leaderboard/blocked` | Unblock a user `{userId}` |
| `GET` | `/api/admin/admins` | List seed + dynamic admins |
| `POST` | `/api/admin/admins` | Add a dynamic admin `{userId, name}` |
| `DELETE` | `/api/admin/admins` | Remove a dynamic admin `{userId}` |

## Privacy

The public leaderboard API (`GET /api/leaderboard`) **does not return user IDs**. Only display names, avatars, and scores are exposed publicly. User IDs are only visible through the admin endpoints, which require admin authentication.

## Setup

1. Set `ADMIN_USER_IDS` in your Worker secrets (or `worker/.dev.vars` for local dev):
   ```
   ADMIN_USER_IDS=google:101504283821800840378,github:12345
   ```
2. Deploy the worker — the first admin(s) can then add more via the UI.
3. Navigate to `/#/admin` and log in with an admin account.
