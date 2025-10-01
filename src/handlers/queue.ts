/**
 * Queue Handler
 * Processes video generation queue messages
 */

import { Env } from '../config/env';
import { VideoPollerService } from '../services/videoPoller';

export async function handleQueueBatch(batch: MessageBatch, env: Env): Promise<void> {
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
}
