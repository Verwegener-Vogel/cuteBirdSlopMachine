import { IVideoGenerator, VideoGenerationResult } from '../../interfaces/IVideoGenerator';
import { IHttpClient } from '../../interfaces/IHttpClient';
import { IOperationPoller } from '../../interfaces/IOperationPoller';

export class VeoVideoGenerator implements IVideoGenerator {
  private readonly apiBase = 'https://generativelanguage.googleapis.com/v1beta';
  private readonly maxPollingAttempts = 60;
  private readonly pollingDelayMs = 5000;

  constructor(
    private readonly httpClient: IHttpClient,
    private readonly operationPoller: IOperationPoller,
    private readonly apiKey: string
  ) {}

  async generateVideo(prompt: string): Promise<VideoGenerationResult> {
    console.log(`Generating video with Veo 3.0 for prompt: ${prompt}`);

    const response = await this.httpClient.request(
      `${this.apiBase}/models/veo-3.0-generate-001:predictLongRunning`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [{
            prompt: `A cute video of ${prompt}. Nature documentary style, high quality, adorable moments.`
          }]
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Veo API error: ${response.status}`, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const operation = await response.json();
    console.log('Veo operation started:', operation.name);
    const operationName = operation.name;

    // Poll the operation until it's done
    for (let attempts = 0; attempts < this.maxPollingAttempts; attempts++) {
      // Skip delay in test environment
      if (this.apiKey !== 'test-api-key' && attempts > 0) {
        await this.delay(this.pollingDelayMs);
      }

      const status = await this.operationPoller.pollOperation(operation.name);
      console.log(`Operation status (attempt ${attempts + 1}):`, JSON.stringify(status));

      if (status.done) {
        if (status.error) {
          throw new Error(`Video generation failed: ${JSON.stringify(status.error)}`);
        }

        const videoUri = this.extractVideoUri(status);
        if (videoUri) {
          console.log('Video generated successfully:', videoUri);
          return { videoUrl: videoUri, operationName };
        } else {
          console.error('Video completed but no URL found in response:', JSON.stringify(status.response));
          throw new Error('Video generation completed but no URL was returned');
        }
      }
    }

    throw new Error(`Video generation timed out after ${this.maxPollingAttempts * this.pollingDelayMs / 1000} seconds`);
  }

  private extractVideoUri(status: any): string | null {
    return status.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
           status.response?.predictions?.[0]?.videoUri ||
           status.response?.videoUri ||
           status.response?.uri ||
           null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}