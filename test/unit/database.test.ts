import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseService } from '../../src/services/database';
import { BirdPrompt } from '../../src/types';

describe('DatabaseService', () => {
  let mockDb: any;
  let dbService: DatabaseService;

  beforeEach(() => {
    // Mock D1 database
    mockDb = {
      exec: vi.fn().mockResolvedValue(undefined),
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    };

    dbService = new DatabaseService(mockDb);
  });

  describe('savePrompt', () => {
    it('should save a new prompt when it does not exist', async () => {
      const prompt = {
        prompt: 'Test bird prompt',
        createdAt: Date.now(),
        cutenessScore: 8,
        alignmentScore: 9,
        visualAppealScore: 7,
        uniquenessScore: 6,
        tags: ['test', 'bird'],
        species: ['Common Eider'],
        style: 'cartoon' as const,
        season: undefined,
      };

      const id = await dbService.savePrompt(prompt);

      expect(id).toBeDefined();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should return existing ID when prompt already exists', async () => {
      const existingId = 'existing-id';
      mockDb.first.mockResolvedValueOnce({ id: existingId });

      const prompt = {
        prompt: 'Existing prompt',
        createdAt: Date.now(),
        cutenessScore: 8,
        alignmentScore: 9,
        visualAppealScore: 7,
        uniquenessScore: 6,
        tags: [],
        species: [],
        style: 'realistic' as const,
        season: undefined,
      };

      const id = await dbService.savePrompt(prompt);

      expect(id).toBe(existingId);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT id FROM prompts WHERE prompt_hash = ?'
      );
    });
  });

  describe('getPrompt', () => {
    it('should return null when prompt does not exist', async () => {
      mockDb.first.mockResolvedValueOnce(null);

      const result = await dbService.getPrompt('non-existent-id');

      expect(result).toBeNull();
    });

    it('should return prompt with all related data', async () => {
      const mockPromptData = {
        id: 'test-id',
        prompt: 'Test prompt',
        created_at: Date.now(),
        cuteness_score: 8,
        alignment_score: 9,
        visual_appeal_score: 7,
        uniqueness_score: 6,
        usage_count: 5,
        style: 'cartoon',
        season: 'summer',
      };

      mockDb.first.mockResolvedValueOnce(mockPromptData);
      mockDb.all
        .mockResolvedValueOnce({ results: [{ tag: 'cute' }, { tag: 'birds' }] })
        .mockResolvedValueOnce({ results: [{ species: 'Common Eider' }] })
        .mockResolvedValueOnce({ results: [{ id: 'video-1' }, { id: 'video-2' }] });

      const result = await dbService.getPrompt('test-id');

      expect(result).toBeDefined();
      expect(result?.id).toBe('test-id');
      expect(result?.tags).toEqual(['cute', 'birds']);
      expect(result?.species).toEqual(['Common Eider']);
      expect(result?.generatedVideos).toEqual(['video-1', 'video-2']);
    });
  });

  describe('getTopPrompts', () => {
    it('should return empty array when no prompts exist', async () => {
      mockDb.all.mockResolvedValueOnce({ results: [] });

      const result = await dbService.getTopPrompts(10);

      expect(result).toEqual([]);
    });

    it('should return top prompts ordered by cuteness score', async () => {
      mockDb.all.mockResolvedValueOnce({
        results: [{ id: 'id-1' }, { id: 'id-2' }],
      });

      // Mock getPrompt calls
      const mockPrompt1: BirdPrompt = {
        id: 'id-1',
        prompt: 'Prompt 1',
        createdAt: Date.now(),
        cutenessScore: 10,
        alignmentScore: 9,
        visualAppealScore: 8,
        uniquenessScore: 7,
        usageCount: 0,
        generatedVideos: [],
        tags: [],
        species: [],
        style: 'cartoon',
      };

      const mockPrompt2: BirdPrompt = {
        id: 'id-2',
        prompt: 'Prompt 2',
        createdAt: Date.now(),
        cutenessScore: 9,
        alignmentScore: 8,
        visualAppealScore: 7,
        uniquenessScore: 6,
        usageCount: 0,
        generatedVideos: [],
        tags: [],
        species: [],
        style: 'realistic',
      };

      // Mock individual prompt fetches
      mockDb.first
        .mockResolvedValueOnce({ ...mockPrompt1, created_at: mockPrompt1.createdAt })
        .mockResolvedValueOnce({ ...mockPrompt2, created_at: mockPrompt2.createdAt });

      mockDb.all
        .mockResolvedValue({ results: [] }); // Empty tags, species, videos

      const result = await dbService.getTopPrompts(2);

      expect(result).toHaveLength(2);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT id FROM prompts ORDER BY cuteness_score DESC LIMIT ?'
      );
    });
  });
});