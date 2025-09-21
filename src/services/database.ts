import { BirdPrompt, VideoGenerationResult } from '../types';

export class DatabaseService {
  constructor(private db: D1Database) {}

  async initializeDatabase(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        cuteness_score REAL NOT NULL,
        alignment_score REAL NOT NULL,
        visual_appeal_score REAL NOT NULL,
        uniqueness_score REAL NOT NULL,
        usage_count INTEGER DEFAULT 0,
        style TEXT CHECK(style IN ('realistic', 'cartoon', 'mixed')),
        season TEXT CHECK(season IN ('spring', 'summer', 'autumn', 'winter', NULL)),
        prompt_hash TEXT NOT NULL UNIQUE
      );
    `);
  }

  async savePrompt(prompt: Omit<BirdPrompt, 'id' | 'usageCount' | 'generatedVideos'>): Promise<string> {
    const id = crypto.randomUUID();
    const promptHash = await this.hashPrompt(prompt.prompt);

    const existing = await this.db
      .prepare('SELECT id FROM prompts WHERE prompt_hash = ?')
      .bind(promptHash)
      .first();

    if (existing) {
      return existing.id as string;
    }

    await this.db
      .prepare(
        `INSERT INTO prompts (
          id, prompt, created_at, cuteness_score, alignment_score,
          visual_appeal_score, uniqueness_score, style, season, prompt_hash, usage_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
      )
      .bind(
        id,
        prompt.prompt,
        prompt.createdAt,
        prompt.cutenessScore,
        prompt.alignmentScore,
        prompt.visualAppealScore,
        prompt.uniquenessScore,
        prompt.style,
        prompt.season || null,
        promptHash
      )
      .run();

    for (const tag of prompt.tags) {
      await this.db
        .prepare('INSERT INTO prompt_tags (prompt_id, tag) VALUES (?, ?)')
        .bind(id, tag)
        .run();
    }

    for (const species of prompt.species) {
      await this.db
        .prepare('INSERT INTO prompt_species (prompt_id, species) VALUES (?, ?)')
        .bind(id, species)
        .run();
    }

    return id;
  }

  async getPrompt(id: string): Promise<BirdPrompt | null> {
    const prompt = await this.db
      .prepare('SELECT * FROM prompts WHERE id = ?')
      .bind(id)
      .first();

    if (!prompt) return null;

    const tags = await this.db
      .prepare('SELECT tag FROM prompt_tags WHERE prompt_id = ?')
      .bind(id)
      .all();

    const species = await this.db
      .prepare('SELECT species FROM prompt_species WHERE prompt_id = ?')
      .bind(id)
      .all();

    const videos = await this.db
      .prepare('SELECT id FROM videos WHERE prompt_id = ?')
      .bind(id)
      .all();

    return {
      id: prompt.id as string,
      prompt: prompt.prompt as string,
      createdAt: prompt.created_at as number,
      cutenessScore: prompt.cuteness_score as number,
      alignmentScore: prompt.alignment_score as number,
      visualAppealScore: prompt.visual_appeal_score as number,
      uniquenessScore: prompt.uniqueness_score as number,
      usageCount: prompt.usage_count as number,
      style: prompt.style as 'realistic' | 'cartoon' | 'mixed',
      season: prompt.season as 'spring' | 'summer' | 'autumn' | 'winter' | undefined,
      tags: tags.results.map(t => t.tag as string),
      species: species.results.map(s => s.species as string),
      generatedVideos: videos.results.map(v => v.id as string),
    };
  }

  async getTopPrompts(limit: number = 10): Promise<BirdPrompt[]> {
    const prompts = await this.db
      .prepare('SELECT id FROM prompts ORDER BY cuteness_score DESC LIMIT ?')
      .bind(limit)
      .all();

    const results = [];
    for (const p of prompts.results) {
      const prompt = await this.getPrompt(p.id as string);
      if (prompt) results.push(prompt);
    }

    return results;
  }

  async saveVideo(video: VideoGenerationResult): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO videos (id, prompt_id, video_url, thumbnail_url, created_at, duration, status, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        video.id,
        video.promptId,
        video.videoUrl,
        video.thumbnailUrl || null,
        video.createdAt,
        video.duration,
        video.status,
        video.error || null
      )
      .run();

    // Only update usage count if promptId is not null
    if (video.promptId) {
      await this.db
        .prepare('UPDATE prompts SET usage_count = usage_count + 1 WHERE id = ?')
        .bind(video.promptId)
        .run();
    }
  }

  private async hashPrompt(prompt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(prompt.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}