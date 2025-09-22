import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GeminiService } from '../../src/services/gemini';

describe('GeminiService', () => {
  let geminiService: GeminiService;
  let mockPromptGenerator: any;
  let mockVideoGenerator: any;
  let mockOperationPoller: any;

  beforeEach(() => {
    // Create mock services for DI
    mockPromptGenerator = {
      generatePromptIdeas: vi.fn(),
    };
    mockVideoGenerator = {
      generateVideo: vi.fn(),
    };
    mockOperationPoller = {
      pollOperation: vi.fn(),
    };

    geminiService = new GeminiService(
      mockPromptGenerator,
      mockVideoGenerator,
      mockOperationPoller
    );
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generatePromptIdeas', () => {
    it('should generate 10 prompt ideas successfully', async () => {
      const mockBatch = {
        ideas: Array(10).fill(null).map((_, i) => ({
          prompt: `Test prompt ${i + 1}`,
          cutenessScore: 7 + i * 0.1,
          alignmentScore: 8,
          visualAppealScore: 7.5,
          uniquenessScore: 6 + i * 0.2,
          reasoning: 'Test reasoning',
          tags: ['test'],
          species: ['Test Species'],
        })),
        generatedAt: Date.now(),
        modelVersion: 'gemini-2.5-pro',
      };

      mockPromptGenerator.generatePromptIdeas.mockResolvedValue(mockBatch);

      const result = await geminiService.generatePromptIdeas();

      expect(result.ideas).toHaveLength(10);
      expect(result.modelVersion).toBe('gemini-2.5-pro');
      expect(result.ideas[0].prompt).toBe('Test prompt 1');
      expect(mockPromptGenerator.generatePromptIdeas).toHaveBeenCalledOnce();
    });

    it('should throw error on API failure', async () => {
      mockPromptGenerator.generatePromptIdeas.mockRejectedValue(
        new Error('Gemini API error: 400')
      );

      await expect(geminiService.generatePromptIdeas()).rejects.toThrow(
        'Gemini API error: 400'
      );
    });

    it('should handle structured output format', async () => {
      const mockBatch = {
        ideas: [{
          prompt: 'Test prompt',
          cutenessScore: 9,
          alignmentScore: 8,
          visualAppealScore: 7,
          uniquenessScore: 6,
          reasoning: 'Test',
          tags: [],
          species: [],
        }],
        generatedAt: Date.now(),
        modelVersion: 'gemini-2.5-pro',
      };

      mockPromptGenerator.generatePromptIdeas.mockResolvedValue(mockBatch);

      const result = await geminiService.generatePromptIdeas();

      expect(result.ideas[0].cutenessScore).toBe(9);
      expect(result.ideas[0].alignmentScore).toBe(8);
    });
  });

  describe('generateVideo', () => {
    it('should generate video URL via Veo API successfully', async () => {
      const mockResult = {
        videoUrl: 'https://generativelanguage.googleapis.com/v1beta/files/abc123:download?alt=media',
        operationName: 'models/veo-3.0-generate-001/operations/test123',
      };

      mockVideoGenerator.generateVideo.mockResolvedValue(mockResult);

      const result = await geminiService.generateVideo('Test prompt');

      expect(result.videoUrl).toBe('https://generativelanguage.googleapis.com/v1beta/files/abc123:download?alt=media');
      expect(result.operationName).toBe('models/veo-3.0-generate-001/operations/test123');
      expect(mockVideoGenerator.generateVideo).toHaveBeenCalledWith('Test prompt');
    });

    it('should handle API errors properly', async () => {
      mockVideoGenerator.generateVideo.mockRejectedValue(new Error('API error: 403'));

      await expect(geminiService.generateVideo('Test prompt')).rejects.toThrow('API error: 403');
    });

    it('should timeout after max attempts', async () => {
      mockVideoGenerator.generateVideo.mockRejectedValue(
        new Error('Video generation timed out after 300 seconds')
      );

      await expect(geminiService.generateVideo('Test prompt')).rejects.toThrow('Video generation timed out after 300 seconds');
    });
  });
});