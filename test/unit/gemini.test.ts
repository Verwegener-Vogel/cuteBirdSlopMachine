import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GeminiService } from '../../src/services/gemini';

// Mock fetch globally
global.fetch = vi.fn();

describe('GeminiService', () => {
  let geminiService: GeminiService;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    geminiService = new GeminiService(mockApiKey);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generatePromptIdeas', () => {
    it('should generate 10 prompt ideas successfully', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    prompts: [
                      {
                        prompt: 'Fluffy baby eider ducklings swimming',
                        cutenessScore: 9.5,
                        alignmentScore: 10,
                        visualAppealScore: 8.5,
                        uniquenessScore: 7,
                        reasoning: 'Baby birds are inherently cute',
                        tags: ['baby_birds', 'water'],
                        species: ['Common Eider'],
                      },
                      {
                        prompt: 'Mute swans dancing in morning mist',
                        cutenessScore: 8,
                        alignmentScore: 9,
                        visualAppealScore: 9.5,
                        uniquenessScore: 8,
                        reasoning: 'Graceful and beautiful',
                        tags: ['swans', 'mist'],
                        species: ['Mute Swan'],
                      },
                      // Add 8 more to make 10 total
                      ...Array(8).fill(null).map((_, i) => ({
                        prompt: `Test prompt ${i + 3}`,
                        cutenessScore: 7 + i * 0.1,
                        alignmentScore: 8,
                        visualAppealScore: 7.5,
                        uniquenessScore: 6 + i * 0.2,
                        reasoning: 'Test reasoning',
                        tags: ['test'],
                        species: ['Test Species'],
                      })),
                    ],
                  }),
                },
              ],
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await geminiService.generatePromptIdeas();

      expect(result.ideas).toHaveLength(10);
      expect(result.modelVersion).toBe('gemini-2.5-pro');
      expect(result.ideas[0].prompt).toBe('Fluffy baby eider ducklings swimming');
      expect(result.ideas[0].cutenessScore).toBe(9.5);
      expect(result.ideas[0].species).toContain('Common Eider');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('gemini-2.5-pro:generateContent'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should throw error on API failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });

      await expect(geminiService.generatePromptIdeas()).rejects.toThrow(
        'Gemini API error: 400'
      );
    });

    it('should handle structured output format', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    prompts: [
                      {
                        prompt: 'Test prompt',
                        cutenessScore: 9,
                        alignmentScore: 8,
                        visualAppealScore: 7,
                        uniquenessScore: 6,
                        reasoning: 'Test',
                        tags: [],
                        species: [],
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await geminiService.generatePromptIdeas();

      expect(result.ideas[0].cutenessScore).toBe(9);
      expect(result.ideas[0].alignmentScore).toBe(8);
    });
  });

  describe('generateVideo', () => {
    it('should request video generation successfully', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  videoUrl: 'https://example.com/video.mp4',
                },
              ],
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await geminiService.generateVideo('Test prompt');

      expect(result.videoUrl).toBe('https://example.com/video.mp4');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('gemini-2.5-pro:generateContent'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Test prompt'),
        })
      );
    });

    it('should return pending when no video URL is provided', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{}],
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await geminiService.generateVideo('Test prompt');

      expect(result.videoUrl).toBe('pending');
    });

    it('should throw error on video generation failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(geminiService.generateVideo('Test prompt')).rejects.toThrow(
        'Video generation error: 500'
      );
    });
  });
});