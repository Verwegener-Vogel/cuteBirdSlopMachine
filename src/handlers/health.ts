/**
 * Health Check Handler
 * Simple health check endpoint for monitoring
 */

import { Env } from '../index';

export async function handleHealth(request: Request, env: Env): Promise<Response> {
  return new Response(
    JSON.stringify({
      status: 'healthy',
      service: 'Cute Bird Slop Machine',
      timestamp: Date.now(),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
