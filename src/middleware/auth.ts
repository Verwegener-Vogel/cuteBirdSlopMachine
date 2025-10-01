/**
 * Authentication Middleware
 * Handles API key authentication for protected endpoints
 */

import { Env } from '../index';

const PROTECTED_ENDPOINTS = ['/generate-prompts', '/generate-video'];

export function requireAuth(request: Request, env: Env): Response | null {
  const url = new URL(request.url);

  // Check if endpoint requires authentication
  const requireAuth = PROTECTED_ENDPOINTS.includes(url.pathname);

  if (!requireAuth) {
    return null; // No auth required
  }

  // Skip auth in non-production environments
  if (env.ENVIRONMENT !== 'production') {
    return null;
  }

  // Validate API key
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey || apiKey !== env.WORKER_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  return null; // Auth successful
}
