import { IVideoGenerator, VideoGenerationResult } from '../../interfaces/IVideoGenerator';

export class MockVideoGenerator implements IVideoGenerator {
  private shouldFail = false;
  private failMessage = '';
  private mockUrl = 'https://test-video-url.com/video.mp4';
  private mockOperationName = 'models/veo-3.0-generate-001/operations/test123';

  async generateVideo(prompt: string): Promise<VideoGenerationResult> {
    console.log(`[MOCK] Generating video for prompt: ${prompt}`);

    if (this.shouldFail) {
      throw new Error(this.failMessage || 'Mock video generation failed');
    }

    return {
      videoUrl: this.mockUrl,
      operationName: this.mockOperationName,
    };
  }

  setMockResponse(url: string, operationName?: string): void {
    this.mockUrl = url;
    if (operationName) {
      this.mockOperationName = operationName;
    }
  }

  setShouldFail(fail: boolean, message?: string): void {
    this.shouldFail = fail;
    this.failMessage = message || '';
  }
}