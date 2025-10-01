import { ServiceFactory } from './services/ServiceFactory';
import { requireAuth } from './middleware/auth';
import { handleCors } from './middleware/cors';
import { handleError } from './middleware/errorHandler';
import { route } from './router';
import { Env } from './config/env';
import { handleQueueBatch } from './handlers/queue';
import { handleScheduled } from './handlers/scheduled';

export { Env };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Initialize DI container for this request
    ServiceFactory.initialize(env);

    try {
      // Handle CORS preflight requests
      const corsResponse = handleCors(request);
      if (corsResponse) {
        return corsResponse;
      }

      // Check authentication for protected endpoints
      const authResponse = requireAuth(request, env);
      if (authResponse) {
        return authResponse;
      }

      // Route the request
      return await route(request, env);
    } catch (error) {
      return handleError(error);
    }
  },

  async queue(batch: MessageBatch, env: Env): Promise<void> {
    return handleQueueBatch(batch, env);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    return handleScheduled(event, env, ctx);
  },
};