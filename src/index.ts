import { GeminiService } from './services/gemini';
import { DatabaseService } from './services/database';
import { VideoPollerService } from './services/videoPoller';
import { VideoGenerationRequest, VideoGenerationResult } from './types';
import { JWT } from './utils/jwt';
import { ServiceFactory } from './services/ServiceFactory';
import { DIContainer } from './container/DIContainer';

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

    // Initialize DI container for this request
    ServiceFactory.initialize(env);
    const geminiService = ServiceFactory.createGeminiService(env);
    const dbService = ServiceFactory.createDatabaseService(env);

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
              // Stream from R2 if available, otherwise not available
              stream: v.r2_key ? `/api/videos/${v.id}/stream` : null,
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

        case '/test-video.html':
          // Simple test page for debugging video playback
          const testHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Video Test</title>
    <style>
        body { font-family: Arial; padding: 20px; background: #f0f0f0; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }
        video { width: 100%; height: auto; background: black; }
        .status { margin: 10px 0; padding: 10px; background: #e0e0e0; border-radius: 5px; }
        button { margin: 5px; padding: 10px 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Video Test</h1>
        <video id="testVideo" controls></video>
        <div class="status" id="status">Ready</div>
        <button onclick="testDirectLoad()">Test Direct Load</button>
        <button onclick="testLazyLoad()">Test Lazy Load</button>
        <button onclick="testWithSource()">Test with Source Element</button>
        <div id="log" style="margin-top: 20px; font-family: monospace; font-size: 12px;"></div>
    </div>
    <script>
        const video = document.getElementById('testVideo');
        const status = document.getElementById('status');
        const logDiv = document.getElementById('log');
        const videoUrl = '/api/videos/034956ca-cb3b-4b53-9062-d3370b3e84d5/stream';

        function log(msg) {
            logDiv.innerHTML += msg + '<br>';
            console.log(msg);
        }

        // Add all event listeners
        ['loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'error', 'stalled'].forEach(event => {
            video.addEventListener(event, (e) => {
                log(\`Event: \${event}\`);
                if (event === 'error' && video.error) {
                    log(\`Error code: \${video.error.code}, message: \${video.error.message}\`);
                }
                if (event === 'canplay' || event === 'canplaythrough') {
                    status.textContent = 'Video loaded successfully!';
                    status.style.background = '#90EE90';
                }
            });
        });

        function testDirectLoad() {
            log('Testing direct src assignment...');
            video.src = videoUrl;
            video.load();
        }

        function testLazyLoad() {
            log('Testing lazy load...');
            video.removeAttribute('src');
            while (video.firstChild) video.removeChild(video.firstChild);
            setTimeout(() => {
                video.src = videoUrl;
                video.load();
            }, 100);
        }

        function testWithSource() {
            log('Testing with source element...');
            video.removeAttribute('src');
            while (video.firstChild) video.removeChild(video.firstChild);
            const source = document.createElement('source');
            source.src = videoUrl;
            source.type = 'video/mp4';
            video.appendChild(source);
            video.load();
        }

        // Test fetch
        fetch(videoUrl, { method: 'HEAD' }).then(r => {
            log(\`Fetch test: \${r.status} \${r.statusText}\`);
        }).catch(e => {
            log(\`Fetch error: \${e.message}\`);
        });
    </script>
</body>
</html>`;
          return new Response(testHtml, {
            headers: { 'Content-Type': 'text/html' }
          });

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

          // Generate HTML with enhanced video players
          const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🐦 Cute Bird Slop Machine - Video Gallery</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
            --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            --card-shadow: 0 10px 30px rgba(0,0,0,0.15);
            --card-hover-shadow: 0 20px 40px rgba(0,0,0,0.25);
            --cuteness-gradient: linear-gradient(45deg, #f093fb 0%, #f5576c 100%);
            --download-gradient: linear-gradient(45deg, #4facfe 0%, #00f2fe 100%);
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: var(--primary-gradient);
            background-attachment: fixed;
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1600px;
            margin: 0 auto;
        }

        /* Header */
        .header {
            text-align: center;
            margin-bottom: 40px;
            animation: fadeInDown 0.8s ease;
        }

        h1 {
            color: white;
            font-size: clamp(2rem, 5vw, 3rem);
            text-shadow: 3px 3px 6px rgba(0,0,0,0.3);
            margin-bottom: 10px;
        }

        .subtitle {
            color: rgba(255,255,255,0.9);
            font-size: 1.1em;
            margin-bottom: 20px;
        }

        /* Stats Bar */
        .stats-bar {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 15px 25px;
            display: inline-flex;
            gap: 30px;
            margin-bottom: 30px;
        }

        .stat {
            color: white;
            font-size: 0.9em;
        }

        .stat strong {
            font-size: 1.2em;
            display: block;
        }

        /* Video Grid */
        .video-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
            gap: 30px;
            animation: fadeInUp 0.8s ease 0.2s both;
        }

        @media (max-width: 768px) {
            .video-grid {
                grid-template-columns: 1fr;
                gap: 20px;
            }
        }

        /* Video Card */
        .video-card {
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: var(--card-shadow);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            animation: fadeInScale 0.5s ease both;
            position: relative;
        }

        .video-card:hover {
            transform: translateY(-8px) scale(1.02);
            box-shadow: var(--card-hover-shadow);
        }

        /* Video Container */
        .video-container {
            position: relative;
            width: 100%;
            padding-top: 56.25%; /* 16:9 Aspect Ratio */
            background: #000;
            overflow: hidden;
        }

        .video-player {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        /* Custom Video Controls Overlay */
        .video-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.3);
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
        }

        .video-container:hover .video-overlay.show-on-hover {
            opacity: 1;
        }

        .play-button {
            width: 70px;
            height: 70px;
            background: rgba(255,255,255,0.9);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform 0.3s;
            pointer-events: all;
        }

        .play-button:hover {
            transform: scale(1.1);
        }

        .play-icon {
            width: 0;
            height: 0;
            border-left: 25px solid #667eea;
            border-top: 15px solid transparent;
            border-bottom: 15px solid transparent;
            margin-left: 5px;
        }

        /* Loading State */
        .video-loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 14px;
            display: none;
            z-index: 10;
        }

        .video-loading.active {
            display: block;
        }

        .spinner {
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top: 3px solid white;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }

        /* Error State */
        .video-error {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            text-align: center;
            padding: 20px;
            display: none;
        }

        .video-error.active {
            display: block;
        }

        .retry-button {
            background: var(--download-gradient);
            color: white;
            border: none;
            padding: 8px 20px;
            border-radius: 20px;
            cursor: pointer;
            margin-top: 10px;
            font-weight: bold;
        }

        /* Video Info */
        .video-info {
            padding: 20px;
        }

        .video-prompt {
            font-size: 15px;
            color: #2c3e50;
            margin-bottom: 15px;
            line-height: 1.5;
            font-weight: 500;
        }

        .video-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }

        .meta-left {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .cuteness-score {
            background: var(--cuteness-gradient);
            color: white;
            padding: 6px 14px;
            border-radius: 25px;
            font-size: 13px;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .video-duration {
            background: rgba(103, 126, 234, 0.1);
            color: #667eea;
            padding: 6px 14px;
            border-radius: 25px;
            font-size: 13px;
            font-weight: 600;
        }

        .action-buttons {
            display: flex;
            gap: 10px;
        }

        .action-btn {
            background: var(--download-gradient);
            color: white;
            padding: 8px 16px;
            border-radius: 25px;
            text-decoration: none;
            font-size: 13px;
            font-weight: bold;
            transition: all 0.3s;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .action-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(79, 172, 254, 0.4);
        }

        .share-btn {
            background: linear-gradient(45deg, #56ab2f 0%, #a8e063 100%);
        }

        /* Loading Animation */
        .loading {
            text-align: center;
            color: white;
            padding: 60px 20px;
            font-size: 1.2em;
        }

        /* No Videos State */
        .no-videos {
            text-align: center;
            color: white;
            padding: 60px 20px;
            font-size: 1.3em;
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            margin: 40px auto;
            max-width: 600px;
        }

        /* Toast Notification */
        .toast {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: white;
            color: #333;
            padding: 15px 25px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            transform: translateY(100px);
            opacity: 0;
            transition: all 0.3s;
            z-index: 1000;
            max-width: 300px;
        }

        .toast.show {
            transform: translateY(0);
            opacity: 1;
        }

        /* Animations */
        @keyframes fadeInDown {
            from {
                opacity: 0;
                transform: translateY(-30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes fadeInScale {
            from {
                opacity: 0;
                transform: scale(0.9);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Progressive Enhancement */
        @supports (backdrop-filter: blur(10px)) {
            .stats-bar {
                background: rgba(255,255,255,0.05);
            }
        }

        /* Reduced Motion */
        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🐦 Cute Bird Slop Machine</h1>
            <p class="subtitle">AI-Generated Baltic Bird Videos</p>
            <div class="stats-bar">
                <div class="stat">
                    <strong>${htmlVideos.results.length}</strong>
                    Videos Available
                </div>
                <div class="stat">
                    <strong>${htmlVideos.results.filter((v: any) => v.cuteness_score && v.cuteness_score >= 8).length}</strong>
                    Ultra Cute (8+)
                </div>
                <div class="stat">
                    <strong>${(htmlVideos.results.reduce((acc: number, v: any) => acc + (v.cuteness_score || 0), 0) / Math.max(htmlVideos.results.length, 1)).toFixed(1)}</strong>
                    Avg Cuteness
                </div>
            </div>
        </div>

        <div class="video-grid">
            ${htmlVideos.results.length === 0 ?
              '<div class="no-videos">🎬 No videos available yet<br><br>Start generating some adorable Baltic bird content!</div>' :
              htmlVideos.results.map((v: any, index: number) => {
                const videoUrl = `/api/videos/${v.id}/stream`;
                const downloadUrl = `/api/videos/${v.id}/download`;
                const animationDelay = index * 0.1;
                return `
                <div class="video-card" style="animation-delay: ${animationDelay}s" data-video-id="${v.id}">
                    <div class="video-container">
                        <video
                            class="video-player"
                            controls
                            preload="none"
                            poster=""
                            data-src="${videoUrl}">
                            Your browser does not support the video tag.
                        </video>
                        <div class="video-loading">
                            <div class="spinner"></div>
                            Loading...
                        </div>
                        <div class="video-error">
                            <div>⚠️ Failed to load video</div>
                            <button class="retry-button" onclick="retryVideo('${v.id}')">Retry</button>
                        </div>
                    </div>
                    <div class="video-info">
                        <div class="video-prompt">${v.prompt || '🐦 A delightful Baltic bird video'}</div>
                        <div class="video-meta">
                            <div class="meta-left">
                                <span class="cuteness-score">
                                    💕 ${v.cuteness_score ? v.cuteness_score.toFixed(1) : 'N/A'}/10
                                </span>
                                <span class="video-duration" data-video-id="${v.id}">--:--</span>
                            </div>
                            <div class="action-buttons">
                                <button class="action-btn share-btn" onclick="shareVideo('${v.id}')">
                                    📤 Share
                                </button>
                                <a href="${downloadUrl}" class="action-btn" download="bird-${v.id}.mp4">
                                    📥 Download
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
                `;
              }).join('')}
        </div>
    </div>

    <div class="toast" id="toast"></div>

    <script>
        // Enhanced video player functionality
        const videos = document.querySelectorAll('.video-player');
        const loadingStates = new Map();
        const retryAttempts = new Map();

        // Intersection Observer for lazy loading
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const video = entry.target;
                    // Check if video hasn't been loaded yet
                    if (video.dataset.src && !video.src) {
                        loadVideo(video);
                        observer.unobserve(video); // Stop observing once loaded
                    }
                }
            });
        }, {
            rootMargin: '100px',
            threshold: 0.1
        });

        // Initialize observers
        videos.forEach(video => {
            observer.observe(video);

            // Add event listeners
            video.addEventListener('loadstart', () => handleLoadStart(video));
            video.addEventListener('loadeddata', () => handleLoadedData(video));
            video.addEventListener('canplay', () => handleLoadedData(video));
            video.addEventListener('canplaythrough', () => handleLoadedData(video));
            video.addEventListener('error', () => handleError(video));
            video.addEventListener('loadedmetadata', () => updateDuration(video));

            // Volume memory
            video.volume = localStorage.getItem('videoVolume') || 0.7;
            video.addEventListener('volumechange', () => {
                localStorage.setItem('videoVolume', video.volume);
            });
        });

        function loadVideo(video) {
            const container = video.closest('.video-container');
            const loading = container.querySelector('.video-loading');

            console.log('Loading video:', video.dataset.src);
            if (loading) {
                loading.classList.add('active');
            }

            // Set src directly on video element
            video.src = video.dataset.src;
            video.load();
            console.log('Set video.src and called load()');
        }

        function handleLoadStart(video) {
            const container = video.closest('.video-container');
            const loading = container.querySelector('.video-loading');
            const error = container.querySelector('.video-error');

            loading.classList.add('active');
            error.classList.remove('active');
        }

        function handleLoadedData(video) {
            const container = video.closest('.video-container');
            const loading = container.querySelector('.video-loading');

            if (loading) {
                loading.classList.remove('active');
                console.log('Video loaded, hiding spinner');
            }
            retryAttempts.delete(video.dataset.src);
        }

        function handleError(video) {
            const container = video.closest('.video-container');
            const loading = container.querySelector('.video-loading');
            const error = container.querySelector('.video-error');

            loading.classList.remove('active');

            // Auto-retry once
            const attempts = retryAttempts.get(video.dataset.src) || 0;
            if (attempts < 1) {
                retryAttempts.set(video.dataset.src, attempts + 1);
                setTimeout(() => {
                    video.load();
                }, 2000);
            } else {
                error.classList.add('active');
            }
        }

        function updateDuration(video) {
            const card = video.closest('.video-card');
            const durationSpan = card.querySelector('.video-duration');

            if (durationSpan && video.duration) {
                const minutes = Math.floor(video.duration / 60);
                const seconds = Math.floor(video.duration % 60);
                durationSpan.textContent = \`\${minutes}:\${seconds.toString().padStart(2, '0')}\`;
            }
        }

        function retryVideo(videoId) {
            const card = document.querySelector(\`.video-card[data-video-id="\${videoId}"]\`);
            const video = card.querySelector('.video-player');
            const error = card.querySelector('.video-error');

            error.classList.remove('active');
            video.load();
        }

        function shareVideo(videoId) {
            const url = \`\${window.location.origin}/api/videos/\${videoId}/stream\`;

            if (navigator.share) {
                navigator.share({
                    title: '🐦 Cute Bird Video',
                    text: 'Check out this adorable AI-generated bird video!',
                    url: url
                }).catch(() => {
                    copyToClipboard(url);
                });
            } else {
                copyToClipboard(url);
            }
        }

        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('Link copied to clipboard! 📋');
            }).catch(() => {
                showToast('Failed to copy link');
            });
        }

        function showToast(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.classList.add('show');

            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            const activeVideo = document.querySelector('video:hover');
            if (!activeVideo) return;

            switch(e.key) {
                case ' ':
                    e.preventDefault();
                    activeVideo.paused ? activeVideo.play() : activeVideo.pause();
                    break;
                case 'ArrowRight':
                    activeVideo.currentTime += 5;
                    break;
                case 'ArrowLeft':
                    activeVideo.currentTime -= 5;
                    break;
                case 'ArrowUp':
                    activeVideo.volume = Math.min(1, activeVideo.volume + 0.1);
                    break;
                case 'ArrowDown':
                    activeVideo.volume = Math.max(0, activeVideo.volume - 0.1);
                    break;
                case 'f':
                    if (activeVideo.requestFullscreen) {
                        activeVideo.requestFullscreen();
                    }
                    break;
            }
        });

        // Performance monitoring
        if ('connection' in navigator) {
            const connection = navigator.connection;
            if (connection.saveData || connection.effectiveType === 'slow-2g') {
                videos.forEach(video => {
                    video.preload = 'none';
                });
            }
        }
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
    // Initialize DI container for queue processing
    ServiceFactory.initialize(env);
    const geminiService = ServiceFactory.createGeminiService(env);
    const dbService = ServiceFactory.createDatabaseService(env);

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
      ServiceFactory.initialize(env);
      const geminiService = ServiceFactory.createGeminiService(env);
      const dbService = ServiceFactory.createDatabaseService(env);

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