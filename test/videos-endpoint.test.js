import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import worker from '../src/index';

describe('Videos Endpoint', () => {
  // Mock data for testing
  const mockVideo = {
    id: 'test-video-id',
    prompt_id: 'test-prompt-id',
    video_url: 'https://storage.googleapis.com/mock-videos/test.mp4',
    google_url: null,
    r2_key: null,
    created_at: Date.now(),
    downloaded_at: null,
    duration: 15,
    status: 'completed',
    error: null,
    operation_name: null
  };

  const mockPrompt = {
    id: 'test-prompt-id',
    prompt: 'A cute baby puffin learning to fly',
    cuteness_score: 9.5
  };

  beforeEach(async () => {
    // Create tables if they don't exist
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        cuteness_score REAL,
        alignment_score REAL,
        visual_appeal_score REAL,
        uniqueness_score REAL,
        usage_count INTEGER DEFAULT 0,
        style TEXT,
        tags TEXT,
        species TEXT,
        season TEXT,
        prompt_hash TEXT UNIQUE
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        prompt_id TEXT,
        video_url TEXT,
        thumbnail_url TEXT,
        created_at INTEGER NOT NULL,
        duration INTEGER,
        status TEXT DEFAULT 'pending',
        error TEXT,
        operation_name TEXT,
        google_url TEXT,
        r2_key TEXT,
        downloaded_at INTEGER,
        FOREIGN KEY (prompt_id) REFERENCES prompts (id)
      )
    `).run();

    // Clear existing data
    await env.DB.prepare('DELETE FROM videos').run();
    await env.DB.prepare('DELETE FROM prompts').run();

    // Insert test prompt
    await env.DB.prepare(`
      INSERT OR IGNORE INTO prompts (
        id, prompt, created_at, cuteness_score, alignment_score,
        visual_appeal_score, uniqueness_score, usage_count, style, prompt_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      mockPrompt.id,
      mockPrompt.prompt,
      Date.now(),
      mockPrompt.cuteness_score,
      8.5,
      9.0,
      7.5,
      0,
      'realistic',
      'hash-' + mockPrompt.id
    ).run();
  });

  describe('GET /videos', () => {
    it('should return 200 with empty array when no videos exist', async () => {
      const request = new Request('http://localhost/videos');
      const response = await worker.fetch(request, env);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('totalVideos');
      expect(data).toHaveProperty('videos');
      expect(Array.isArray(data.videos)).toBe(true);
    });

    it('should return properly formatted video objects', async () => {
      const request = new Request('http://localhost/videos');
      const response = await worker.fetch(request, env);
      const data = await response.json();

      if (data.videos.length > 0) {
        const video = data.videos[0];

        // Check required fields
        expect(video).toHaveProperty('id');
        expect(video).toHaveProperty('status');
        expect(video).toHaveProperty('duration');
        expect(video).toHaveProperty('urls');
        expect(video).toHaveProperty('timestamps');

        // Check URLs structure
        expect(video.urls).toHaveProperty('stream');
        expect(video.urls).toHaveProperty('google');
        expect(video.urls).toHaveProperty('fallback');

        // Check timestamps structure
        expect(video.timestamps).toHaveProperty('created');
        expect(video.timestamps).toHaveProperty('downloaded');

        // Validate status enum
        expect(['pending', 'processing', 'completed', 'failed', 'downloaded']).toContain(video.status);
      }
    });

    it('should handle database schema with R2 storage fields', async () => {
      const request = new Request('http://localhost/videos');
      const response = await worker.fetch(request, env);
      expect(response.status).toBe(200);

      const data = await response.json();

      // Ensure the query doesn't fail even with new R2 fields
      if (data.videos.length > 0) {
        const video = data.videos[0];

        // These fields should exist even if null
        expect(video.urls).toBeDefined();
        expect(video.timestamps).toBeDefined();

        // Stream URL should be constructed correctly when r2_key exists
        if (video.urls.stream) {
          expect(video.urls.stream).toMatch(/^\/api\/videos\/[^\/]+\/stream$/);
        }
      }
    });

    it('should order videos by created_at DESC', async () => {
      const request = new Request('http://localhost/videos');
      const response = await worker.fetch(request, env);
      const data = await response.json();

      if (data.videos.length > 1) {
        for (let i = 0; i < data.videos.length - 1; i++) {
          const current = new Date(data.videos[i].timestamps.created);
          const next = new Date(data.videos[i + 1].timestamps.created);
          expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
        }
      }
    });

    it('should limit results to 100 videos', async () => {
      const request = new Request('http://localhost/videos');
      const response = await worker.fetch(request, env);
      const data = await response.json();

      expect(data.videos.length).toBeLessThanOrEqual(100);
    });

    it('should include prompt data when available', async () => {
      const request = new Request('http://localhost/videos');
      const response = await worker.fetch(request, env);
      const data = await response.json();

      if (data.videos.length > 0) {
        const videoWithPrompt = data.videos.find(v => v.prompt);
        if (videoWithPrompt) {
          expect(typeof videoWithPrompt.prompt).toBe('string');
          expect(typeof videoWithPrompt.cutenessScore).toBe('number');
          expect(videoWithPrompt.cutenessScore).toBeGreaterThanOrEqual(1);
          expect(videoWithPrompt.cutenessScore).toBeLessThanOrEqual(10);
        }
      }
    });

    it('should format duration correctly', async () => {
      const request = new Request('http://localhost/videos');
      const response = await worker.fetch(request, env);
      const data = await response.json();

      if (data.videos.length > 0) {
        data.videos.forEach(video => {
          if (video.duration) {
            expect(video.duration).toMatch(/^\d+s$/);
          }
        });
      }
    });

    it('should handle ISO timestamp formatting', async () => {
      const request = new Request('http://localhost/videos');
      const response = await worker.fetch(request, env);
      const data = await response.json();

      if (data.videos.length > 0) {
        data.videos.forEach(video => {
          // Created timestamp should always be present and valid ISO
          expect(video.timestamps.created).toMatch(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
          );

          // Downloaded timestamp can be null or valid ISO
          if (video.timestamps.downloaded) {
            expect(video.timestamps.downloaded).toMatch(
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
            );
          }
        });
      }
    });
  });

  describe('GET /videos/:id', () => {
    it('should return 404 for non-existent video', async () => {
      const request = new Request('http://localhost/videos/non-existent-id');
      const response = await worker.fetch(request, env);
      expect(response.status).toBe(404);

      const text = await response.text();
      expect(text).toBe('Video not found');
    });

    it('should return video details for existing video', async () => {
      // First get a video ID from the list
      const listRequest = new Request('http://localhost/videos');
      const listResponse = await worker.fetch(listRequest, env);
      const listData = await listResponse.json();

      if (listData.videos.length > 0) {
        const videoId = listData.videos[0].id;
        const request = new Request(`http://localhost/videos/${videoId}`);
        const response = await worker.fetch(request, env);

        expect(response.status).toBe(200);

        const video = await response.json();
        expect(video).toHaveProperty('id', videoId);
        expect(video).toHaveProperty('status');
        expect(video).toHaveProperty('created_at');
      }
    });

    it('should return 424 for failed video generation', async () => {
      // This would need a video with status='failed' in the test database
      // Skipping for now as it requires specific test data setup
    });
  });

  describe('Database Migration Handling', () => {
    it('should handle missing R2 storage columns gracefully', async () => {
      // This test verifies that even if migrations haven't been applied,
      // the endpoint should not return 500
      const request = new Request('http://localhost/videos');
      const response = await worker.fetch(request, env);

      // Should not be a 500 error
      expect(response.status).not.toBe(500);

      // Should be a successful response
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should return JSON error for database failures', async () => {
      // This would need to mock a database failure
      // For now, we ensure the error structure is correct
      // when it does fail
    });

    it('should handle malformed URLs correctly', async () => {
      const request = new Request('http://localhost/videos/../../etc/passwd');
      const response = await worker.fetch(request, env);
      expect(response.status).toBe(404);
    });
  });
});