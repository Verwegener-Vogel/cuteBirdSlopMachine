import { env } from 'cloudflare:test';
import { beforeAll } from 'vitest';

beforeAll(async () => {
  // Create the tables needed for tests
  const createTablesSQL = `
    -- Create prompts table with all required columns
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      cuteness_score REAL,
      alignment_score REAL,
      visual_appeal_score REAL,
      uniqueness_score REAL,
      style TEXT,
      season TEXT,
      usage_count INTEGER DEFAULT 0,
      tags TEXT,
      species TEXT,
      prompt_hash TEXT UNIQUE
    );

    -- Create prompt_tags table
    CREATE TABLE IF NOT EXISTS prompt_tags (
      prompt_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      FOREIGN KEY (prompt_id) REFERENCES prompts(id),
      PRIMARY KEY (prompt_id, tag)
    );

    -- Create prompt_species table
    CREATE TABLE IF NOT EXISTS prompt_species (
      prompt_id TEXT NOT NULL,
      species TEXT NOT NULL,
      FOREIGN KEY (prompt_id) REFERENCES prompts(id),
      PRIMARY KEY (prompt_id, species)
    );

    -- Create videos table with all columns including R2 storage
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      prompt_id TEXT,
      video_url TEXT,
      thumbnail_url TEXT,
      created_at INTEGER NOT NULL,
      duration INTEGER,
      status TEXT NOT NULL,
      error TEXT,
      operation_name TEXT,
      google_url TEXT,
      r2_key TEXT,
      downloaded_at INTEGER
    );

    -- Create indices for performance
    CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at);
    CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
    CREATE INDEX IF NOT EXISTS idx_videos_prompt_id ON videos(prompt_id);
  `;

  // Execute each statement separately
  const statements = createTablesSQL.split(';').filter(s => s.trim());
  for (const statement of statements) {
    if (statement.trim()) {
      await env.DB.prepare(statement).run();
    }
  }
});