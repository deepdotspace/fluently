/**
 * Cron task definitions, registered into the CronRoom DO at construction
 * time (worker.ts). The DO alarm fires `runTask(name, env)` on each task's
 * schedule; the DO itself records executions, tracks history, and pushes
 * status to admin clients via the `/ws/cron/:roomId` WebSocket.
 *
 * Each task declares EITHER `intervalMinutes` (run every N minutes) OR
 * `schedule` + `timezone` (5-field cron expression). For example:
 *
 *   import { buildCronContext } from 'deepspace/worker'
 *
 *   export const tasks: CronTask[] = [
 *     { name: 'daily-review-reset', schedule: '0 4 * * *', timezone: 'UTC' },
 *   ]
 *
 *   export async function runTask(name: string, env: unknown): Promise<void> {
 *     const ctx = buildCronContext(env, env.OWNER_USER_ID, `app:${env.APP_NAME}`)
 *     if (name === 'daily-review-reset') { ... }
 *   }
 */

import type { CronTask } from 'deepspace/worker'

export const tasks: CronTask[] = []

export async function runTask(_name: string, _env: unknown): Promise<void> {
  // No-op: implement scheduled tasks here, dispatching on `_name`.
}
