import { ServiceFactory } from './ServiceFactory';

export interface VideoPollerEnv {
  GOOGLE_AI_API_KEY: string;
  DB: D1Database;
  VIDEO_STORAGE: R2Bucket;
}

export class VideoPollerService {
  constructor(private env: VideoPollerEnv) {}

  async pollPendingVideos(): Promise<number> {
    ServiceFactory.initialize(this.env);
    const operationPoller = ServiceFactory.getContainer().get('operationPoller');
    let processedCount = 0;

    try {
      // Get all pending videos with operation names
      const pendingVideos = await this.env.DB
        .prepare(`
          SELECT id, operation_name, prompt_id
          FROM videos
          WHERE status = 'pending' AND operation_name IS NOT NULL
          LIMIT 20
        `)
        .all();

      console.log(`Polling ${pendingVideos.results.length} pending videos`);

      for (const video of pendingVideos.results) {
        try {
          const status = await operationPoller.pollOperation(video.operation_name as string);

          if (status.done) {
            if (status.error) {
              // Update as failed
              await this.env.DB
                .prepare('UPDATE videos SET status = ?, error = ? WHERE id = ?')
                .bind('failed', JSON.stringify(status.error), video.id)
                .run();
            } else {
              // Extract the Google video URL
              const googleUrl = this.extractVideoUrl(status.response);

              if (googleUrl) {
                // Update with Google URL first
                await this.env.DB
                  .prepare('UPDATE videos SET status = ?, google_url = ? WHERE id = ?')
                  .bind('completed', googleUrl, video.id)
                  .run();

                // Download to R2 storage
                await this.downloadToR2(video.id as string, googleUrl);
              }
            }
            processedCount++;
          }
        } catch (error) {
          console.error(`Failed to poll video ${video.id}:`, error);
        }
      }

      // Also process completed videos that haven't been downloaded yet
      await this.downloadCompletedVideos();

    } catch (error) {
      console.error('Polling error:', error);
    }

    return processedCount;
  }


  private extractVideoUrl(response: any): string | null {
    return response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
           response?.predictions?.[0]?.videoUri ||
           response?.videoUri ||
           response?.uri ||
           null;
  }

  private async downloadCompletedVideos(): Promise<void> {
    // Get videos that are completed but not yet downloaded
    const completedVideos = await this.env.DB
      .prepare(`
        SELECT id, google_url
        FROM videos
        WHERE status = 'completed'
        AND google_url IS NOT NULL
        AND r2_key IS NULL
        LIMIT 10
      `)
      .all();

    for (const video of completedVideos.results) {
      try {
        await this.downloadToR2(video.id as string, video.google_url as string);
      } catch (error) {
        console.error(`Failed to download video ${video.id}:`, error);
      }
    }
  }

  private async downloadToR2(videoId: string, googleUrl: string): Promise<void> {
    try {
      // Download the video from Google
      const response = await fetch(googleUrl, {
        headers: {
          'x-goog-api-key': this.env.GOOGLE_AI_API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status}`);
      }

      // Generate R2 key
      const r2Key = `videos/${videoId}/${Date.now()}.mp4`;

      // Upload to R2 - stream directly without buffering in memory
      await this.env.VIDEO_STORAGE.put(r2Key, response.body, {
        httpMetadata: {
          contentType: 'video/mp4',
        },
        customMetadata: {
          videoId,
          downloadedFrom: googleUrl,
          downloadedAt: new Date().toISOString(),
        },
      });

      // Update database with R2 key and mark as downloaded
      const videoUrl = `/api/videos/${videoId}/stream`;
      await this.env.DB
        .prepare(`
          UPDATE videos
          SET status = 'downloaded',
              r2_key = ?,
              video_url = ?,
              downloaded_at = ?
          WHERE id = ?
        `)
        .bind(r2Key, videoUrl, Date.now(), videoId)
        .run();

      console.log(`Video ${videoId} downloaded to R2: ${r2Key}`);
    } catch (error) {
      console.error(`Failed to download video ${videoId} to R2:`, error);
      // Don't update status, leave it as completed so we can retry later
    }
  }
}