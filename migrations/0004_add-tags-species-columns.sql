-- Add tags and species columns to prompts table for easier querying
-- These will store JSON arrays of the tags and species

ALTER TABLE prompts ADD COLUMN tags TEXT DEFAULT '[]';
ALTER TABLE prompts ADD COLUMN species TEXT DEFAULT '[]';

-- Populate the new columns from the existing normalized tables
UPDATE prompts
SET tags = (
    SELECT json_group_array(tag)
    FROM prompt_tags
    WHERE prompt_tags.prompt_id = prompts.id
)
WHERE EXISTS (
    SELECT 1 FROM prompt_tags WHERE prompt_tags.prompt_id = prompts.id
);

UPDATE prompts
SET species = (
    SELECT json_group_array(species)
    FROM prompt_species
    WHERE prompt_species.prompt_id = prompts.id
)
WHERE EXISTS (
    SELECT 1 FROM prompt_species WHERE prompt_species.prompt_id = prompts.id
);

-- Also add prompt_text to videos table for easier display
ALTER TABLE videos ADD COLUMN prompt_text TEXT;

UPDATE videos
SET prompt_text = (
    SELECT prompt FROM prompts WHERE prompts.id = videos.prompt_id
);