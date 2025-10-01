/**
 * Prompts Handler
 * Handles prompt generation and listing
 */

import { Env } from '../index';
import { ServiceFactory } from '../services/ServiceFactory';

export async function handleGeneratePrompts(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const geminiService = ServiceFactory.createGeminiService(env);
  const dbService = ServiceFactory.createDatabaseService(env);

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
}

export async function handleGetPrompts(request: Request, env: Env): Promise<Response> {
  const dbService = ServiceFactory.createDatabaseService(env);
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
}
