/** Cloudflare Worker environment bindings */
export interface Env {
  // KV Namespaces
  QUESTIONS_CACHE: KVNamespace
  LEADERBOARD: KVNamespace
  SESSIONS: KVNamespace

  // Secrets
  GITHUB_TOKEN: string
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  JWT_SECRET: string
}

/** Leaderboard entry stored in KV */
export interface StoredLeaderboardEntry {
  /** Unique ID (provider:userId) */
  id: string
  /** OAuth provider used */
  provider: 'github' | 'google'
  /** Display name */
  displayName: string
  /** Avatar URL */
  avatarUrl: string
  /** Verified score */
  score: number
  /** Maximum possible score */
  maxScore: number
  /** Score percentage (0–100) */
  percentage: number
  /** Whether the user passed */
  passed: boolean
  /** Elapsed time in ms */
  timeMs: number
  /** Upstream commit SHA of the questions used */
  commitSha: string
  /** When the score was submitted (ISO string) */
  submittedAt: string
}

/** JWT session payload */
export interface SessionPayload {
  /** User ID from OAuth provider */
  sub: string
  /** OAuth provider */
  provider: 'github' | 'google'
  /** Display name */
  name: string
  /** Avatar URL */
  avatar: string
  /** Issued at (unix seconds) */
  iat: number
  /** Expires at (unix seconds) */
  exp: number
}

/** Cached questions data in KV */
export interface CachedQuestions {
  questions: unknown[] // Question[] from shared schema
  commitSha: string
  cachedAt: string
}
