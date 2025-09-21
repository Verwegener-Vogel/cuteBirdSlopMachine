-- Create prompts table
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
  usage_count INTEGER DEFAULT 0
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

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  prompt_id TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  created_at INTEGER NOT NULL,
  duration INTEGER,
  status TEXT NOT NULL,
  error TEXT
);

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_prompt_id ON videos(prompt_id);