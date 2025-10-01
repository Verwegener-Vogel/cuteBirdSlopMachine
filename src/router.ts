/**
 * Router
 * Maps URL patterns to handler functions
 */

import { Env } from './index';
import { handleHealth } from './handlers/health';
import { handleGeneratePrompts, handleGetPrompts } from './handlers/prompts';
import { handleGallery, handleTestPlayer } from './handlers/ui';
import {
  handleGenerateVideo,
  handleStreamVideo,
  handleDownloadVideo,
  handleGetVideo,
  handleListVideos,
  handleVideoStatus,
  handlePollVideos,
} from './handlers/videos';

type RouteHandler = (request: Request, env: Env, params?: Record<string, string>) => Promise<Response>;

interface Route {
  pattern: RegExp;
  handler: RouteHandler;
  method?: string;
}

const routes: Route[] = [
  // Health check
  { pattern: /^\/health$/, handler: handleHealth },

  // Prompt endpoints
  { pattern: /^\/generate-prompts$/, handler: handleGeneratePrompts, method: 'POST' },
  { pattern: /^\/prompts$/, handler: handleGetPrompts },

  // Video generation
  { pattern: /^\/generate-video$/, handler: handleGenerateVideo, method: 'POST' },

  // Video polling and status
  { pattern: /^\/poll-videos$/, handler: handlePollVideos },
  { pattern: /^\/video-status$/, handler: handleVideoStatus },

  // Video endpoints
  { pattern: /^\/videos$/, handler: handleListVideos },
  {
    pattern: /^\/videos\/([^\/]+)\/stream$/,
    handler: (request, env, params) => handleStreamVideo(request, env, params!.videoId)
  },
  {
    pattern: /^\/videos\/([^\/]+)\/download$/,
    handler: (request, env, params) => handleDownloadVideo(request, env, params!.videoId)
  },
  {
    pattern: /^\/videos\/([^\/]+)$/,
    handler: (request, env, params) => handleGetVideo(request, env, params!.videoId)
  },

  // UI pages
  { pattern: /^\/test-video\.html$/, handler: handleTestPlayer },
  { pattern: /^\/$/, handler: handleGallery },
  { pattern: /^\/videos\.html$/, handler: handleGallery },
];

export async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  let pathMatched = false;

  // Try to match routes
  for (const routeConfig of routes) {
    const match = pathname.match(routeConfig.pattern);

    if (match) {
      pathMatched = true;

      // Check method if specified
      if (routeConfig.method && method !== routeConfig.method) {
        continue;
      }

      // Extract path parameters (e.g., video ID)
      const params: Record<string, string> = {};
      if (match.length > 1) {
        params.videoId = match[1];
      }

      return routeConfig.handler(request, env, params);
    }
  }

  // If path matched but method didn't, return 405
  if (pathMatched) {
    return new Response('Method not allowed', { status: 405 });
  }

  // No route matched
  return new Response('Not found', { status: 404 });
}
