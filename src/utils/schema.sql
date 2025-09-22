-- D1 Database schema for bird prompts

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

CREATE INDEX IF NOT EXISTS idx_prompts_cuteness ON prompts(cuteness_score DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_created ON prompts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_usage ON prompts(usage_count);

CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    prompt_id TEXT NOT NULL,
    video_url TEXT,
    thumbnail_url TEXT,
    created_at INTEGER NOT NULL,
    duration INTEGER,
    status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'downloaded')),
    error TEXT,
    operation_name TEXT,
    google_url TEXT,
    r2_key TEXT,
    downloaded_at INTEGER,
    FOREIGN KEY (prompt_id) REFERENCES prompts(id)
);

CREATE INDEX IF NOT EXISTS idx_videos_prompt ON videos(prompt_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_operation ON videos(operation_name);

CREATE TABLE IF NOT EXISTS prompt_tags (
    prompt_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    PRIMARY KEY (prompt_id, tag),
    FOREIGN KEY (prompt_id) REFERENCES prompts(id)
);

CREATE TABLE IF NOT EXISTS prompt_species (
    prompt_id TEXT NOT NULL,
    species TEXT NOT NULL,
    PRIMARY KEY (prompt_id, species),
    FOREIGN KEY (prompt_id) REFERENCES prompts(id)
);