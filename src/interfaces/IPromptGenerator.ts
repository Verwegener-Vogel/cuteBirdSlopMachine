import { PromptGenerationBatch } from '../types';

export interface IPromptGenerator {
  generatePromptIdeas(): Promise<PromptGenerationBatch>;
}