import { Env } from '../index';
import { VideoGenerationRequest, VideoGenerationResult } from '../types';
import { JWT } from '../utils/jwt';
import { ServiceFactory } from '../services/ServiceFactory';
import { VideoPollerService } from '../services/videoPoller';

/**
 * Generate a new video from a prompt
 * POST /generate-video
 */
export async function handleGenerateVideo(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const geminiService = ServiceFactory.createGeminiService(env);
  const dbService = ServiceFactory.createDatabaseService(env);

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
}

/**
 * Stream a video from R2 storage with range support
 * GET /videos/:id/stream
 */
export async function handleStreamVideo(request: Request, env: Env, videoId: string): Promise<Response> {
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

  // Support range requests for video streaming
  const range = request.headers.get('Range');
  let object;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : undefined;

    console.log('[Stream] Range request:', start, '-', end || 'end');

    // Use R2's range option to fetch only the requested bytes
    object = await env.VIDEO_STORAGE.get(video.r2_key as string, {
      range: { offset: start, length: end ? end - start + 1 : undefined }
    });

    if (!object) {
      console.error('[Stream] R2 object not found for key:', video.r2_key);
      return new Response('Video file not found', { status: 404 });
    }

    const totalSize = object.range ? object.range.offset + object.size : object.size;
    const actualEnd = end || totalSize - 1;

    const headers = new Headers();
    headers.set('Content-Type', 'video/mp4');
    headers.set('Content-Range', `bytes ${start}-${actualEnd}/${totalSize}`);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Length', String(actualEnd - start + 1));
    headers.set('Cache-Control', 'private, max-age=3600');

    return new Response(object.body, {
      status: 206,
      headers,
    });
  } else {
    // Full file request
    console.log('[Stream] Looking for R2 key:', video.r2_key);
    object = await env.VIDEO_STORAGE.get(video.r2_key as string);

    if (!object) {
      console.error('[Stream] R2 object not found for key:', video.r2_key);
      return new Response('Video file not found', { status: 404 });
    }
    console.log('[Stream] Found R2 object, size:', object.size);

    const headers = new Headers();
    headers.set('Content-Type', 'video/mp4');
    headers.set('Content-Length', object.size.toString());
    headers.set('Cache-Control', 'private, max-age=3600');
    headers.set('Accept-Ranges', 'bytes');

    return new Response(object.body, {
      headers,
    });
  }
}

/**
 * Download a video file with token authentication
 * GET /videos/:id/download?token=...
 */
export async function handleDownloadVideo(request: Request, env: Env, videoId: string): Promise<Response> {
  const url = new URL(request.url);
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

/**
 * Get video metadata by ID
 * GET /videos/:id
 */
export async function handleGetVideo(request: Request, env: Env, videoId: string): Promise<Response> {
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

/**
 * List all videos with metadata
 * GET /videos
 */
export async function handleListVideos(request: Request, env: Env): Promise<Response> {
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
      // Stream from R2 if available, otherwise not available
      stream: v.r2_key ? `/videos/${v.id}/stream` : null,
      // Secure download link with token (only if in R2)
      download: null as string | null, // Will be populated with token if available
      // Fallback URL for legacy data
      fallback: v.video_url,
    },
    timestamps: {
      created: new Date(v.created_at).toISOString(),
      downloaded: v.downloaded_at ? new Date(v.downloaded_at).toISOString() : null,
    },
  }));

  // Generate download tokens only for videos in R2
  for (const video of formattedVideos) {
    if (video.id && video.urls.stream) {
      const token = await JWT.createToken(video.id, 'download', env.WORKER_API_KEY, 15);
      video.urls.download = `/videos/${video.id}/download?token=${token}`;
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
}

/**
 * Get status of all videos with optional update from Google API
 * GET /video-status?update=true
 */
export async function handleVideoStatus(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
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
          const status: any = await response.json();
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
}

/**
 * Manual trigger for polling pending videos (development helper)
 * GET /poll-videos
 */
export async function handlePollVideos(request: Request, env: Env): Promise<Response> {
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
}
