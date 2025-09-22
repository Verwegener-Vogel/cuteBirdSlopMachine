import { PromptIdea, PromptGenerationBatch } from '../types';
import { IPromptGenerator } from '../interfaces/IPromptGenerator';
import { IVideoGenerator } from '../interfaces/IVideoGenerator';
import { IOperationPoller } from '../interfaces/IOperationPoller';

/**
 * Service facade that delegates to injected dependencies
 * This ensures single responsibility and testability
 */
export class GeminiService {
  constructor(
    private readonly promptGenerator: IPromptGenerator,
    private readonly videoGenerator: IVideoGenerator,
    private readonly operationPoller: IOperationPoller
  ) {}

  async generatePromptIdeas(): Promise<PromptGenerationBatch> {
    return this.promptGenerator.generatePromptIdeas();
  }

  async pollOperation(operationName: string): Promise<any> {
    return this.operationPoller.pollOperation(operationName);
  }

  async generateVideo(prompt: string): Promise<{ videoUrl: string; operationName?: string }> {
    return this.videoGenerator.generateVideo(prompt);
  }
}