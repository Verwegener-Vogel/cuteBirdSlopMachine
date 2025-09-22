import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GeminiService } from '../../src/services/gemini';
import { MockHttpClient } from '../../src/services/mocks/MockHttpClient';
import { MockVideoGenerator } from '../../src/services/mocks/MockVideoGenerator';
import { GeminiPromptGenerator } from '../../src/services/ai/GeminiPromptGenerator';
import { GeminiOperationPoller } from '../../src/services/ai/GeminiOperationPoller';

describe('GeminiService with Dependency Injection', () => {
  let mockHttpClient: MockHttpClient;
  let mockVideoGenerator: MockVideoGenerator;
  let promptGenerator: GeminiPromptGenerator;
  let operationPoller: GeminiOperationPoller;
  let geminiService: GeminiService;

  beforeEach(() => {
    // Create mock implementations
    mockHttpClient = new MockHttpClient();
    mockVideoGenerator = new MockVideoGenerator();

    // Create real services with mocked HTTP client
    promptGenerator = new GeminiPromptGenerator(mockHttpClient, 'test-api-key');
    operationPoller = new GeminiOperationPoller(mockHttpClient, 'test-api-key');

    // Create service with injected dependencies
    geminiService = new GeminiService(promptGenerator, mockVideoGenerator, operationPoller);
  });

  afterEach(() => {
    mockHttpClient.clearMocks();
  });

  describe('generatePromptIdeas', () => {
    it('should generate prompt ideas through injected service', async () => {
      const mockPromptResponse = {
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
                    ],
                  }),
                },
              ],
            },
          },
        ],
      };

      // Mock the HTTP response
      mockHttpClient.mockResponse(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=test-api-key',
        {
          ok: true,
          status: 200,
          json: async () => mockPromptResponse,
          text: async () => JSON.stringify(mockPromptResponse),
        }
      );

      const result = await geminiService.generatePromptIdeas();

      expect(result.ideas).toHaveLength(1);
      expect(result.ideas[0].prompt).toBe('Fluffy baby eider ducklings swimming');
      expect(result.ideas[0].cutenessScore).toBe(9.5);

      // Verify HTTP client was called
      const history = mockHttpClient.getRequestHistory();
      expect(history).toHaveLength(1);
      expect(history[0].url).toContain('gemini-2.5-pro:generateContent');
    });

    it('should handle API errors gracefully', async () => {
      // Mock an error response
      mockHttpClient.mockResponse(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=test-api-key',
        {
          ok: false,
          status: 403,
          json: async () => { throw new Error('Forbidden'); },
          text: async () => 'API key invalid',
        }
      );

      await expect(geminiService.generatePromptIdeas()).rejects.toThrow('Gemini API error: 403');
    });
  });

  describe('generateVideo', () => {
    it('should generate video through injected service', async () => {
      mockVideoGenerator.setMockResponse(
        'https://generated-video.mp4',
        'operation-123'
      );

      const result = await geminiService.generateVideo('Test prompt');

      expect(result.videoUrl).toBe('https://generated-video.mp4');
      expect(result.operationName).toBe('operation-123');
    });

    it('should handle video generation failures', async () => {
      mockVideoGenerator.setShouldFail(true, 'Service unavailable');

      await expect(geminiService.generateVideo('Test prompt')).rejects.toThrow('Service unavailable');
    });
  });

  describe('pollOperation', () => {
    it('should poll operation through injected service', async () => {
      const mockOperationStatus = {
        name: 'operation-123',
        done: true,
        response: {
          generateVideoResponse: {
            generatedSamples: [
              {
                video: {
                  uri: 'https://video-url.mp4',
                },
              },
            ],
          },
        },
      };

      mockHttpClient.mockResponse(
        'https://generativelanguage.googleapis.com/v1beta/operation-123',
        {
          ok: true,
          status: 200,
          json: async () => mockOperationStatus,
          text: async () => JSON.stringify(mockOperationStatus),
        }
      );

      const result = await geminiService.pollOperation('operation-123');

      expect(result.done).toBe(true);
      expect(result.response.generateVideoResponse.generatedSamples[0].video.uri).toBe('https://video-url.mp4');
    });
  });
});