import { VideoPollerService } from './services/videoPoller';
import { ServiceFactory } from './services/ServiceFactory';
import { requireAuth } from './middleware/auth';
import { handleCors } from './middleware/cors';
import { handleError } from './middleware/errorHandler';
import { route } from './router';

export interface Env {
  GOOGLE_AI_API_KEY: string;
  WORKER_API_KEY: string;
  DB: D1Database;
  VIDEO_QUEUE: Queue;
  PROMPTS_KV: KVNamespace;
  VIDEO_STORAGE: R2Bucket;
  ENVIRONMENT: string;
}

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
    // Initialize video poller service for queue processing
    const poller = new VideoPollerService({
      GOOGLE_AI_API_KEY: env.GOOGLE_AI_API_KEY,
      DB: env.DB,
      VIDEO_STORAGE: env.VIDEO_STORAGE,
    });

    for (const message of batch.messages) {
      const { id, promptId, prompt, operationName } = message.body as any;

      try {
        console.log(`Queue processing video ${id} with operation ${operationName}`);

        // Poll for the specific video completion and download to R2
        const result = await poller.pollSpecificVideo(id, operationName);

        if (result) {
          console.log(`Video ${id} processed successfully via queue`);
          message.ack();
        } else {
          console.log(`Video ${id} not yet ready, retrying`);
          message.retry();
        }
      } catch (error) {
        console.error(`Failed to process video ${id} in queue:`, error);

        await env.DB
          .prepare(
            'UPDATE videos SET status = ?, error = ? WHERE id = ?'
          )
          .bind('failed', error instanceof Error ? error.message : 'Unknown error', id)
          .run();

        message.retry();
      }
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const cronType = event.cron;

    // Different cron jobs for different tasks
    if (cronType === '*/1 * * * *' || cronType === '* * * * *') {
      // Poll videos every minute (runs every minute)
      const poller = new VideoPollerService({
        GOOGLE_AI_API_KEY: env.GOOGLE_AI_API_KEY,
        DB: env.DB,
        VIDEO_STORAGE: env.VIDEO_STORAGE,
      });

      try {
        const processed = await poller.pollPendingVideos();
        console.log(`Video polling: processed ${processed} videos`);
      } catch (error) {
        console.error('Video polling failed:', error);
      }
    } else {
      // Generate prompts every 6 hours
      ServiceFactory.initialize(env);
      const geminiService = ServiceFactory.createGeminiService(env);
      const dbService = ServiceFactory.createDatabaseService(env);

      try {
        const batch = await geminiService.generatePromptIdeas();

        for (const idea of batch.ideas) {
          await dbService.savePrompt({
            prompt: idea.prompt,
            createdAt: Date.now(),
            cutenessScore: idea.cutenessScore,
            alignmentScore: idea.alignmentScore,
            visualAppealScore: idea.visualAppealScore,
            uniquenessScore: idea.uniquenessScore,
            tags: idea.tags,
            species: idea.species,
            style: idea.prompt.includes('cartoon') ? 'cartoon' :
                   idea.prompt.includes('realistic') ? 'realistic' : 'mixed',
            season: undefined,
          });
        }

        console.log(`Generated ${batch.ideas.length} new prompts`);
      } catch (error) {
        console.error('Scheduled prompt generation failed:', error);
      }
    }
  },
};