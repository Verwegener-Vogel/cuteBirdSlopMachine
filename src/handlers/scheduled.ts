/**
 * Scheduled Handler
 * Processes cron-triggered tasks
 */

import { Env } from '../config/env';
import { ServiceFactory } from '../services/ServiceFactory';
import { VideoPollerService } from '../services/videoPoller';

export async function handleScheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  const cronType = event.cron;

  // Different cron jobs for different tasks
  if (cronType === '*/1 * * * *' || cronType === '* * * * *') {
    // Poll videos every minute
    await pollVideos(env);
  } else {
    // Generate prompts every 6 hours
    await generatePrompts(env);
  }
}

async function pollVideos(env: Env): Promise<void> {
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
}

async function generatePrompts(env: Env): Promise<void> {
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
