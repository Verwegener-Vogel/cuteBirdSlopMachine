/**
 * Environment Configuration
 * Type-safe access to environment variables
 */

export interface Env {
  GOOGLE_AI_API_KEY: string;
  WORKER_API_KEY: string;
  DB: D1Database;
  VIDEO_QUEUE: Queue;
  PROMPTS_KV: KVNamespace;
  VIDEO_STORAGE: R2Bucket;
  ENVIRONMENT: string;
}

export function isProduction(env: Env): boolean {
  return env.ENVIRONMENT === 'production';
}

export function isDevelopment(env: Env): boolean {
  return env.ENVIRONMENT !== 'production';
}
