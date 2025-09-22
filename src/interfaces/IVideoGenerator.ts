export interface VideoGenerationResult {
  videoUrl: string;
  operationName?: string;
}

export interface IVideoGenerator {
  generateVideo(prompt: string): Promise<VideoGenerationResult>;
}