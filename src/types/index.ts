export interface BirdPrompt {
  id: string;
  prompt: string;
  createdAt: number;
  cutenessScore: number;
  alignmentScore: number;
  visualAppealScore: number;
  uniquenessScore: number;
  usageCount: number;
  generatedVideos: string[];
  tags: string[];
  species: string[];
  style: 'realistic' | 'cartoon' | 'mixed';
  season?: 'spring' | 'summer' | 'autumn' | 'winter';
}

export interface VideoGenerationRequest {
  promptId: string;
  prompt: string;
  style: 'realistic' | 'cartoon' | 'mixed';
  duration: number;
  includeSound: boolean;
}

export interface VideoGenerationResult {
  id: string;
  promptId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  createdAt: number;
  duration: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface PromptIdea {
  prompt: string;
  cutenessScore: number;
  alignmentScore: number;
  visualAppealScore: number;
  uniquenessScore: number;
  reasoning: string;
  tags: string[];
  species: string[];
}

export interface PromptGenerationBatch {
  ideas: PromptIdea[];
  generatedAt: number;
  modelVersion: string;
}