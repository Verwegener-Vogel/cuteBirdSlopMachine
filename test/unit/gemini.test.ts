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
    it('should generate mock video URL successfully', async () => {
      const result = await geminiService.generateVideo('Test prompt');

      expect(result.videoUrl).toMatch(/^https:\/\/storage\.googleapis\.com\/mock-bird-videos\//);
      expect(result.videoUrl).toContain('Test%20prompt');
      expect(result.videoUrl).toContain('.mp4');
    });

    it('should handle different prompts correctly', async () => {
      const prompt = 'A cute baby puffin';
      const result = await geminiService.generateVideo(prompt);

      expect(result.videoUrl).toContain(encodeURIComponent(prompt));
    });

    it('should handle long prompts by truncating to 50 chars', async () => {
      const longPrompt = 'A very long prompt that exceeds the fifty character limit and will be truncated';
      const result = await geminiService.generateVideo(longPrompt);

      expect(result.videoUrl).toMatch(/^https:\/\/storage\.googleapis\.com\/mock-bird-videos\//);
      expect(result.videoUrl).toContain('.mp4');
      // Should only contain first 50 chars encoded
      const urlParts = result.videoUrl.split('/');
      const filename = urlParts[urlParts.length - 1];
      // 50 chars of the prompt are encoded in the filename
      expect(filename).toContain(encodeURIComponent(longPrompt.slice(0, 50)));
    });
  });
});