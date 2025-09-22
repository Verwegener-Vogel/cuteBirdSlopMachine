import { GeminiService } from './services/gemini';
import { DatabaseService } from './services/database';
import { VideoPollerService } from './services/videoPoller';
import { VideoGenerationRequest, VideoGenerationResult } from './types';
import { JWT } from './utils/jwt';

export interface Env {
  GOOGLE_AI_API_KEY: string;
  WORKER_API_KEY: string;
  DB: D1Database;
  VIDEO_QUEUE: Queue;
  PROMPTS_KV: KVNamespace;
  VIDEO_STORAGE: R2Bucket;
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const geminiService = new GeminiService(env.GOOGLE_AI_API_KEY);
    const dbService = new DatabaseService(env.DB);

    try {
      // API Key authentication for sensitive endpoints
      const requireAuth = ['/generate-prompts', '/generate-video'].includes(url.pathname);
      if (requireAuth && env.ENVIRONMENT === 'production') {
        const apiKey = request.headers.get('X-API-Key');
        if (!apiKey || apiKey !== env.WORKER_API_KEY) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            {
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
      }

      // Handle OPTIONS requests for CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
            'Access-Control-Max-Age': '86400',
          },
        });
      }

      switch (url.pathname) {
        case '/generate-prompts':
          if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
          }

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

        case '/generate-video':
          if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
          }

          const videoRequest: VideoGenerationRequest = await request.json();
          const videoId = crypto.randomUUID();

          // Start the video generation directly and get the operation name
          const { operationName } = await geminiService.generateVideo(videoRequest.prompt);

          await env.VIDEO_QUEUE.send({
            id: videoId,
            promptId: videoRequest.promptId || null,
            prompt: videoRequest.prompt,
            timestamp: Date.now(),
            operationName,
          });

          const video: VideoGenerationResult = {
            id: videoId,
            promptId: videoRequest.promptId || null,
            videoUrl: '',
            createdAt: Date.now(),
            duration: videoRequest.duration || 15,
            status: 'pending',
          };

          await dbService.saveVideo(video, operationName);

          return new Response(
            JSON.stringify({
              success: true,
              videoId,
              status: 'queued',
            }),
            {
              status: 202,
              headers: { 'Content-Type': 'application/json' },
            }
          );

        case '/prompts':
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

        case '/health':
          return new Response(
            JSON.stringify({
              status: 'healthy',
              service: 'Cute Bird Slop Machine',
              timestamp: Date.now(),
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );

        case '/poll-videos':
          // Manual trigger for video polling (development helper)
          if (env.ENVIRONMENT !== 'production') {
            const poller = new VideoPollerService({
              GOOGLE_AI_API_KEY: env.GOOGLE_AI_API_KEY,
              DB: env.DB,
              VIDEO_STORAGE: env.VIDEO_STORAGE,
            });

            try {
              const processed = await poller.pollPendingVideos();
              return new Response(
                JSON.stringify({
                  success: true,
                  message: `Processed ${processed} videos`,
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                }
              );
            } catch (error) {
              return new Response(
                JSON.stringify({
                  success: false,
                  error: error instanceof Error ? error.message : 'Unknown error',
                }),
                {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' },
                }
              );
            }
          }
          return new Response('Not available in production', { status: 403 });

        case '/video-status':
          // Check if update parameter is provided
          const shouldUpdate = url.searchParams.get('update') === 'true';

          if (shouldUpdate) {
            // Get all pending videos with their stored operation names
            const pendingVideos = await env.DB
              .prepare(`
                SELECT v.id, v.prompt_id, v.operation_name, p.prompt
                FROM videos v
                LEFT JOIN prompts p ON v.prompt_id = p.id
                WHERE v.status = 'pending' AND v.operation_name IS NOT NULL
                LIMIT 10
              `)
              .all();

            // Check each pending video's status with Google
            const updatePromises = pendingVideos.results.map(async (video: any) => {
              try {
                const response = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/${video.operation_name}`,
                  {
                    method: 'GET',
                    headers: {
                      'x-goog-api-key': env.GOOGLE_AI_API_KEY,
                    },
                  }
                );

                if (response.ok) {
                  const status = await response.json();
                  console.log(`Status check for ${video.id}:`, status.done ? 'done' : 'in progress');

                  if (status.done) {
                    // Update video status in database
                    if (status.error) {
                      await env.DB
                        .prepare('UPDATE videos SET status = ?, error = ? WHERE id = ?')
                        .bind('failed', JSON.stringify(status.error), video.id)
                        .run();
                    } else {
                      // Extract the real video URL from Veo response
                      const veoResponse = status.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
                                        status.response?.predictions?.[0]?.videoUri ||
                                        status.response?.videoUri ||
                                        status.response?.uri;

                      const videoUrl = veoResponse || `https://storage.googleapis.com/generated-videos/${video.id}.mp4`;

                      await env.DB
                        .prepare('UPDATE videos SET status = ?, video_url = ? WHERE id = ?')
                        .bind('completed', videoUrl, video.id)
                        .run();
                    }
                  }
                }
              } catch (error) {
                console.error(`Failed to update video ${video.id}:`, error);
              }
            });

            await Promise.all(updatePromises);
          }

          // Get all videos with their status
          const videos = await env.DB
            .prepare(`
              SELECT
                id,
                prompt_id,
                status,
                error,
                created_at,
                duration,
                video_url
              FROM videos
              ORDER BY created_at DESC
              LIMIT 100
            `)
            .all();

          // Group by status for summary
          const statusCounts = videos.results.reduce((acc: any, video: any) => {
            acc[video.status] = (acc[video.status] || 0) + 1;
            return acc;
          }, {});

          return new Response(
            JSON.stringify({
              summary: {
                total: videos.results.length,
                byStatus: statusCounts,
                lastUpdated: Date.now(),
                updatePerformed: shouldUpdate
              },
              videos: videos.results.map((v: any) => ({
                id: v.id,
                status: v.status,
                error: v.error,
                hasUrl: !!v.video_url,
                createdAt: v.created_at,
                ageSeconds: Math.floor((Date.now() - v.created_at) / 1000)
              }))
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );

        case '/videos':
          // Human-readable list of all videos
          const allVideos = await env.DB
            .prepare(`
              SELECT
                v.id,
                v.status,
                v.video_url,
                v.google_url,
                v.r2_key,
                v.created_at,
                v.downloaded_at,
                v.duration,
                p.prompt,
                p.cuteness_score
              FROM videos v
              LEFT JOIN prompts p ON v.prompt_id = p.id
              ORDER BY v.created_at DESC
              LIMIT 100
            `)
            .all();

          // Format for human consumption
          const formattedVideos = allVideos.results.map((v: any) => ({
            id: v.id,
            prompt: v.prompt,
            status: v.status,
            cutenessScore: v.cuteness_score,
            duration: `${v.duration}s`,
            urls: {
              // Prioritize R2 cached URL if available, then Google URL, never mock
              primary: v.r2_key ? `/api/videos/${v.id}/stream` : (v.google_url || v.video_url),
              // Secure download link with token
              download: null, // Will be populated with token
              // Google URL expires in 2 days, only include as backup
              temporary_google: v.google_url,
              // Original mock/fallback URL
              original: v.video_url,
            },
            timestamps: {
              created: new Date(v.created_at).toISOString(),
              downloaded: v.downloaded_at ? new Date(v.downloaded_at).toISOString() : null,
            },
          }));

          // Generate download tokens for each video
          for (const video of formattedVideos) {
            if (video.id) {
              const token = await JWT.createToken(video.id, 'download', env.WORKER_API_KEY, 15);
              video.urls.download = `/api/videos/${video.id}/download?token=${token}`;
            }
          }

          // Add CORS headers for browser access
          const headers = new Headers({
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          });

          return new Response(
            JSON.stringify({
              totalVideos: formattedVideos.length,
              videos: formattedVideos,
            }, null, 2),
            {
              status: 200,
              headers,
            }
          );

        case '/videos.html':
          // HTML video gallery with embedded players
          const htmlVideos = await env.DB
            .prepare(`
              SELECT
                v.id,
                v.status,
                v.video_url,
                v.r2_key,
                p.prompt,
                p.cuteness_score
              FROM videos v
              LEFT JOIN prompts p ON v.prompt_id = p.id
              WHERE v.r2_key IS NOT NULL AND v.r2_key != 'null'
              ORDER BY v.created_at DESC
              LIMIT 50
            `)
            .all();

          // Generate HTML with embedded video players
          const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🐦 Cute Bird Slop Machine - Video Gallery</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        h1 {
            color: white;
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5em;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .video-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 25px;
        }
        .video-card {
            background: white;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            transition: transform 0.3s ease;
        }
        .video-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.3);
        }
        .video-player {
            width: 100%;
            height: 250px;
            background: #000;
        }
        .video-info {
            padding: 15px;
        }
        .video-prompt {
            font-size: 14px;
            color: #333;
            margin-bottom: 10px;
            line-height: 1.4;
        }
        .video-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 10px;
        }
        .cuteness-score {
            background: linear-gradient(45deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
        }
        .download-btn {
            background: linear-gradient(45deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            padding: 8px 15px;
            border-radius: 20px;
            text-decoration: none;
            font-size: 12px;
            font-weight: bold;
            transition: opacity 0.3s;
        }
        .download-btn:hover {
            opacity: 0.8;
        }
        .loading {
            text-align: center;
            color: white;
            padding: 20px;
        }
        .no-videos {
            text-align: center;
            color: white;
            padding: 40px;
            font-size: 1.2em;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🐦 Cute Bird Slop Machine</h1>
        <div class="video-grid">
            ${htmlVideos.results.length === 0 ?
              '<div class="no-videos">No videos available yet. Start generating some cute bird content!</div>' :
              htmlVideos.results.map((v: any) => {
                // Use R2 streaming for all videos (they all have r2_key due to WHERE clause)
                const videoUrl = `/api/videos/${v.id}/stream`;
                const downloadUrl = `/api/videos/${v.id}/download`;
                return `
                <div class="video-card">
                    <video class="video-player" controls preload="metadata" loading="lazy">
                        <source src="${videoUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                    <div class="video-info">
                        <div class="video-prompt">${v.prompt || 'A delightful bird video'}</div>
                        <div class="video-meta">
                            <span class="cuteness-score">💕 ${v.cuteness_score ? v.cuteness_score.toFixed(1) : 'N/A'}/10</span>
                            <a href="${downloadUrl}" class="download-btn" data-video-id="${v.id}" download="bird-${v.id}.mp4">📥 Download</a>
                        </div>
                    </div>
                </div>
                `;
              }).join('')}
        </div>
    </div>
    <script>
        // Lazy load videos when they come into viewport
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const video = entry.target;
                    if (video.dataset.src && !video.src) {
                        video.src = video.dataset.src;
                        video.load();
                    }
                }
            });
        }, { rootMargin: '50px' });

        document.querySelectorAll('video').forEach(video => {
            observer.observe(video);
        });
    </script>
</body>
</html>`;

          return new Response(html, {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'no-cache',
            },
          });

        default:
          // Check for video download endpoint
          if (url.pathname.match(/^\/api\/videos\/[^\/]+\/download$/)) {
            const videoId = url.pathname.split('/')[3];
            const token = url.searchParams.get('token');

            // Validate token if provided
            if (token) {
              const payload = await JWT.verify(token, env.WORKER_API_KEY);
              if (!payload || payload.action !== 'download' || (payload.videoId && payload.videoId !== videoId)) {
                return new Response('Invalid or expired token', { status: 403 });
              }
            } else if (env.ENVIRONMENT === 'production') {
              return new Response('Token required', { status: 401 });
            }

            // Get video from database
            const video = await env.DB
              .prepare('SELECT r2_key, video_url FROM videos WHERE id = ?')
              .bind(videoId)
              .first();

            if (!video) {
              return new Response('Video not found', { status: 404 });
            }

            // If we have R2 key, generate presigned URL
            if (video.r2_key && env.VIDEO_STORAGE) {
              const object = await env.VIDEO_STORAGE.get(video.r2_key as string);

              if (!object) {
                return new Response('Video file not found', { status: 404 });
              }

              return new Response(object.body, {
                headers: {
                  'Content-Type': 'video/mp4',
                  'Content-Disposition': `attachment; filename="bird-${videoId}.mp4"`,
                  'Cache-Control': 'private, max-age=3600',
                  'Access-Control-Allow-Origin': '*',
                },
              });
            } else if (video.video_url) {
              // Redirect to original URL if no R2 copy
              return Response.redirect(video.video_url as string, 302);
            }

            return new Response('Video not available', { status: 404 });
          }

          // Check for video streaming endpoint
          if (url.pathname.match(/^\/api\/videos\/[^\/]+\/stream$/)) {
            // Extract video ID from path
            const videoId = url.pathname.split('/')[3];

            // For local development, skip auth. In production, require auth for sensitive operations
            if (env.ENVIRONMENT === 'production') {
              const authHeader = request.headers.get('Authorization');
              if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return new Response('Unauthorized', { status: 401 });
              }

              const token = authHeader.substring(7);
              if (token !== env.WORKER_API_KEY) {
                return new Response('Invalid token', { status: 403 });
              }
            }

            // Get video from database
            const video = await env.DB
              .prepare('SELECT r2_key, status FROM videos WHERE id = ?')
              .bind(videoId)
              .first();

            if (!video) {
              return new Response('Video not found', { status: 404 });
            }

            if (!video.r2_key) {
              return new Response('Video not available for streaming', { status: 404 });
            }

            // Stream from R2
            console.log('[Stream] Looking for R2 key:', video.r2_key);
            const object = await env.VIDEO_STORAGE.get(video.r2_key as string);

            if (!object) {
              console.error('[Stream] R2 object not found for key:', video.r2_key);
              return new Response('Video file not found', { status: 404 });
            }
            console.log('[Stream] Found R2 object, size:', object.size);

            const headers = new Headers();
            object.httpMetadata?.contentType && headers.set('Content-Type', object.httpMetadata.contentType);
            headers.set('Content-Length', object.size.toString());
            headers.set('Cache-Control', 'private, max-age=3600');

            // Support range requests for video streaming
            const range = request.headers.get('Range');
            if (range) {
              const parts = range.replace(/bytes=/, '').split('-');
              const start = parseInt(parts[0], 10);
              const end = parts[1] ? parseInt(parts[1], 10) : object.size - 1;

              headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
              headers.set('Accept-Ranges', 'bytes');
              headers.set('Content-Length', String(end - start + 1));

              return new Response(object.body, {
                status: 206,
                headers,
              });
            }

            return new Response(object.body, {
              headers,
            });
          }

          if (url.pathname.startsWith('/videos/')) {
            const videoId = url.pathname.split('/')[2];
            const video = await env.DB
              .prepare('SELECT * FROM videos WHERE id = ?')
              .bind(videoId)
              .first();

            if (!video) {
              return new Response('Video not found', { status: 404 });
            }

            // Return appropriate status code based on video status
            const httpStatus = video.status === 'failed' ? 424 : 200; // 424 Failed Dependency for failed generation

            return new Response(JSON.stringify(video), {
              status: httpStatus,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('Error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  },

  async queue(batch: MessageBatch, env: Env): Promise<void> {
    const geminiService = new GeminiService(env.GOOGLE_AI_API_KEY);
    const dbService = new DatabaseService(env.DB);

    for (const message of batch.messages) {
      const { id, promptId, prompt } = message.body as any;

      try {
        const { videoUrl, operationName } = await geminiService.generateVideo(prompt);

        await env.DB
          .prepare(
            'UPDATE videos SET status = ?, google_url = ?, operation_name = ? WHERE id = ?'
          )
          .bind('completed', videoUrl, operationName || null, id)
          .run();

        message.ack();
      } catch (error) {
        console.error(`Failed to generate video ${id}:`, error);

        await env.DB
          .prepare(
            'UPDATE videos SET status = ?, error = ? WHERE id = ?'
          )
          .bind('failed', error instanceof Error ? error.message : 'Unknown error', id)
          .run();

        message.retry();
      }
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const cronType = event.cron;

    // Different cron jobs for different tasks
    if (cronType === '*/1 * * * *' || cronType === '* * * * *') {
      // Poll videos every minute (runs every minute)
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
    } else {
      // Generate prompts every 6 hours
      const geminiService = new GeminiService(env.GOOGLE_AI_API_KEY);
      const dbService = new DatabaseService(env.DB);

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
  },
};