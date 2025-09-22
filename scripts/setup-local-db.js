#!/usr/bin/env node

/**
 * Setup script for local D1 database
 * Ensures all migrations are properly applied for local development
 */

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const REQUIRED_COLUMNS = {
  videos: ['google_url', 'r2_key', 'downloaded_at', 'operation_name']
};

async function checkColumnExists(table, column) {
  try {
    const { stdout } = await execAsync(
      `npx wrangler d1 execute bird-prompts-db --local --command "PRAGMA table_info(${table})"`
    );
    return stdout.includes(column);
  } catch {
    return false;
  }
}

async function addColumnIfMissing(table, column, type) {
  const exists = await checkColumnExists(table, column);

  if (!exists) {
    console.log(`Adding missing column ${table}.${column}...`);
    try {
      await execAsync(
        `npx wrangler d1 execute bird-prompts-db --local --command "ALTER TABLE ${table} ADD COLUMN ${column} ${type}"`
      );
      console.log(`✅ Added ${table}.${column}`);
    } catch (error) {
      console.error(`❌ Failed to add ${table}.${column}:`, error.message);
    }
  } else {
    console.log(`✓ Column ${table}.${column} already exists`);
  }
}

async function setupDatabase() {
  console.log('Setting up local D1 database...\n');

  // Check and add missing columns
  await addColumnIfMissing('videos', 'google_url', 'TEXT');
  await addColumnIfMissing('videos', 'r2_key', 'TEXT');
  await addColumnIfMissing('videos', 'downloaded_at', 'INTEGER');
  await addColumnIfMissing('videos', 'operation_name', 'TEXT');

  // Create indexes if they don't exist
  console.log('\nCreating indexes...');
  try {
    await execAsync(
      `npx wrangler d1 execute bird-prompts-db --local --command "CREATE INDEX IF NOT EXISTS idx_videos_operation ON videos(operation_name)"`
    );
    console.log('✅ Indexes created');
  } catch (error) {
    console.error('❌ Failed to create indexes:', error.message);
  }

  console.log('\n✨ Database setup complete!');
}

setupDatabase().catch(console.error);