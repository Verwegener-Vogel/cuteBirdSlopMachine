import { GeminiService } from './services/gemini';
import { DatabaseService } from './services/database';
import { VideoGenerationRequest, VideoGenerationResult } from './types';

export interface Env {
  GOOGLE_AI_API_KEY: string;
  WORKER_API_KEY: string;
  DB: D1Database;
  VIDEO_QUEUE: Queue;
  PROMPTS_KV: KVNamespace;
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const geminiService = new GeminiService(env.GOOGLE_AI_API_KEY);
    const dbService = new DatabaseService(env.DB);

    try {
      // API Key authentication for sensitive endpoints
      const requireAuth = ['/generate-prompts', '/generate-video'].includes(url.pathname);
      if (requireAuth && env.ENVIRONMENT === 'production') {
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
      }

      switch (url.pathname) {
        case '/generate-prompts':
          if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
          }

          const batch = await geminiService.generatePromptIdeas();
          const savedPromptIds = [];

          for (const idea of batch.ideas) {
            const promptId = await dbService.savePrompt({
              prompt: idea.prompt,
              createdAt: Date.now(),
              cutenessScore: idea.cutenessScore,
              alignmentScore: idea.alignmentScore,
              visualAppealScore: idea.visualAppealScore,
              uniquenessScore: idea.uniquenessScore,
              tags: idea.tags,
              species: idea.species,
              style: idea.prompt?.includes('cartoon') ? 'cartoon' :
                     idea.prompt?.includes('realistic') ? 'realistic' : 'mixed',
              season: undefined,
            });
            savedPromptIds.push(promptId);
          }

          return new Response(
            JSON.stringify({
              success: true,
              promptsGenerated: batch.ideas.length,
              savedPromptIds,
              batch,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );

        case '/generate-video':
          if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
          }

          const videoRequest: VideoGenerationRequest = await request.json();
          const videoId = crypto.randomUUID();

          await env.VIDEO_QUEUE.send({
            id: videoId,
            promptId: videoRequest.promptId,
            prompt: videoRequest.prompt,
            timestamp: Date.now(),
          });

          const video: VideoGenerationResult = {
            id: videoId,
            promptId: videoRequest.promptId,
            videoUrl: '',
            createdAt: Date.now(),
            duration: videoRequest.duration || 15,
            status: 'pending',
          };

          await dbService.saveVideo(video);

          return new Response(
            JSON.stringify({
              success: true,
              videoId,
              status: 'queued',
            }),
            {
              status: 202,
              headers: { 'Content-Type': 'application/json' },
            }
          );

        case '/prompts':
          const prompts = await dbService.getTopPrompts(20);
          return new Response(
            JSON.stringify({
              success: true,
              prompts,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );

        case '/health':
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

        default:
          if (url.pathname.startsWith('/videos/')) {
            const videoId = url.pathname.split('/')[2];
            const video = await env.DB
              .prepare('SELECT * FROM videos WHERE id = ?')
              .bind(videoId)
              .first();

            if (!video) {
              return new Response('Video not found', { status: 404 });
            }

            return new Response(JSON.stringify(video), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('Error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  },

  async queue(batch: MessageBatch, env: Env): Promise<void> {
    const geminiService = new GeminiService(env.GOOGLE_AI_API_KEY);
    const dbService = new DatabaseService(env.DB);

    for (const message of batch.messages) {
      const { id, promptId, prompt } = message.body as any;

      try {
        const { videoUrl } = await geminiService.generateVideo(prompt);

        await env.DB
          .prepare(
            'UPDATE videos SET status = ?, video_url = ? WHERE id = ?'
          )
          .bind('completed', videoUrl, id)
          .run();

        message.ack();
      } catch (error) {
        console.error(`Failed to generate video ${id}:`, error);

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
    const geminiService = new GeminiService(env.GOOGLE_AI_API_KEY);
    const dbService = new DatabaseService(env.DB);

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
  },
};