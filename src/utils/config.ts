/** Global app configuration constants */

/** Worker API base URL (empty string in local dev → requests go through Vite proxy) */
export const WORKER_BASE_URL = import.meta.env.VITE_WORKER_URL ?? 'https://isaqb-exam.enking.dev'
