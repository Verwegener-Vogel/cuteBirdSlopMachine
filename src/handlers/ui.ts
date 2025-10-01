/**
 * UI Handlers
 * Serves HTML pages
 */

import { Env } from '../index';
import { TemplateLoader } from '../templates/loader';

export async function handleTestPlayer(request: Request, env: Env): Promise<Response> {
  return new Response(TemplateLoader.getTestPlayer(), {
    headers: { 'Content-Type': 'text/html' }
  });
}

export async function handleGallery(request: Request, env: Env): Promise<Response> {
  // Fetch videos and prompts for the UI
  const htmlVideos = await env.DB
    .prepare(`
      SELECT
        v.id,
        v.status,
        v.video_url,
        v.r2_key,
        v.prompt_id,
        p.prompt,
        p.cuteness_score
      FROM videos v
      LEFT JOIN prompts p ON v.prompt_id = p.id
      WHERE v.r2_key IS NOT NULL AND v.r2_key != 'null'
      ORDER BY v.created_at DESC
      LIMIT 50
    `)
    .all();

  const availablePrompts = await env.DB
    .prepare(`
      SELECT
        p.id,
        p.prompt,
        p.cuteness_score,
        p.alignment_score,
        p.visual_appeal_score,
        p.uniqueness_score,
        p.species,
        p.tags,
        p.created_at,
        COUNT(CASE WHEN v.r2_key IS NOT NULL AND v.r2_key != 'null' THEN v.id END) as video_count
      FROM prompts p
      LEFT JOIN videos v ON p.id = v.prompt_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 100
    `)
    .all();

  const html = TemplateLoader.getGallery({
    videos: htmlVideos.results as any[],
    prompts: availablePrompts.results as any[]
  });

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache',
    },
  });
}
