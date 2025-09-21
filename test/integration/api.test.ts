import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import worker from '../../src/index';
import '../test-setup';

describe('Worker API Integration Tests', () => {
  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const request = new Request('http://localhost/health');
      const response = await worker.fetch(request, env);
      const json = await response.json() as any;

      expect(response.status).toBe(200);
      expect(json).toMatchObject({
        status: 'healthy',
        service: 'Cute Bird Slop Machine',
        timestamp: expect.any(Number),
      });
    });
  });

  describe('GET /prompts', () => {
    it('should return prompts list', async () => {
      const request = new Request('http://localhost/prompts');
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(200);
      const json = await response.json() as any;
      expect(json).toMatchObject({
        success: true,
        prompts: expect.any(Array),
      });
    });
  });

  describe('POST /generate-prompts', () => {
    it('should reject request without API key in production mode', async () => {
      const testEnv = {
        ...env,
        ENVIRONMENT: 'production',
        WORKER_API_KEY: 'correct-key',
      };

      const request = new Request('http://localhost/generate-prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const response = await worker.fetch(request, testEnv);

      expect(response.status).toBe(401);
      const json = await response.json() as any;
      expect(json.error).toBe('Unauthorized');
    });

    it('should accept request with valid API key in production mode', async () => {
      // Use real API key if available from environment
      const realApiKey = process.env.GOOGLE_AI_API_KEY || env.GOOGLE_AI_API_KEY;
      const testEnv = {
        ...env,
        ENVIRONMENT: 'production',
        WORKER_API_KEY: 'correct-key',
        GOOGLE_AI_API_KEY: realApiKey || 'test-api-key',
      };

      const request = new Request('http://localhost/generate-prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'correct-key',
        },
        body: JSON.stringify({}),
      });

      const response = await worker.fetch(request, testEnv);

      // With real API key, expect success; otherwise just check auth passed
      if (realApiKey && realApiKey !== 'test-api-key' && realApiKey !== 'demo-api-key') {
        expect(response.status).toBe(200);
        const json = await response.json() as any;
        expect(json).toMatchObject({
          success: true,
          promptsGenerated: 10,
          savedPromptIds: expect.any(Array),
          batch: expect.objectContaining({
            ideas: expect.any(Array),
          }),
        });
      } else {
        // Without real API key, just ensure authentication passes
        expect(response.status).not.toBe(401);
      }
    });

    it('should reject GET requests', async () => {
      const request = new Request('http://localhost/generate-prompts', {
        method: 'GET',
      });

      const response = await worker.fetch(request, env);

      expect(response.status).toBe(405);
    });
  });

  describe('POST /generate-video', () => {
    it('should accept video generation request', async () => {
      const request = new Request('http://localhost/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-worker-key',
        },
        body: JSON.stringify({
          prompt: 'Test bird video prompt',
          duration: 15,
        }),
      });

      const response = await worker.fetch(request, env);

      expect(response.status).toBe(202);
      const json = await response.json() as any;
      expect(json).toMatchObject({
        success: true,
        videoId: expect.any(String),
        status: 'queued',
      });
    });

    it('should accept video generation with promptId', async () => {
      const request = new Request('http://localhost/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-worker-key',
        },
        body: JSON.stringify({
          promptId: 'test-prompt-id',
          prompt: 'Test bird video prompt',
        }),
      });

      const response = await worker.fetch(request, env);

      expect(response.status).toBe(202);
      const json = await response.json() as any;
      expect(json).toMatchObject({
        success: true,
        videoId: expect.any(String),
        status: 'queued',
      });
    });

    it('should reject GET requests', async () => {
      const request = new Request('http://localhost/generate-video', {
        method: 'GET',
      });

      const response = await worker.fetch(request, env);

      expect(response.status).toBe(405);
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
  });

  describe('Unknown routes', () => {
    it('should return 404 for unknown endpoints', async () => {
      const request = new Request('http://localhost/unknown-endpoint');
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(404);
      const text = await response.text();
      expect(text).toBe('Not found');
    });

    it('should return 404 for root path', async () => {
      const request = new Request('http://localhost/');
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON in POST requests', async () => {
      const request = new Request('http://localhost/generate-prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-worker-key',
        },
        body: 'invalid-json',
      });

      const response = await worker.fetch(request, env);

      expect([400, 500]).toContain(response.status);
    });
  });
});