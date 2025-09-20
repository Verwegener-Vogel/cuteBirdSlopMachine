#!/usr/bin/env node

/**
 * Generate a secure API key for worker authentication
 */

const crypto = require('crypto');

function generateApiKey() {
  // Generate a 32-byte random key
  const buffer = crypto.randomBytes(32);

  // Convert to base64 URL-safe format
  const apiKey = buffer.toString('base64url');

  console.log('🔑 Generated Worker API Key:');
  console.log('━'.repeat(50));
  console.log(apiKey);
  console.log('━'.repeat(50));
  console.log('\n📋 Add this to your GitHub Secrets:');
  console.log('   Name: WORKER_API_KEY');
  console.log('   Value:', apiKey);
  console.log('\n🔐 For local development, add to .env:');
  console.log('   WORKER_API_KEY=' + apiKey);

  return apiKey;
}

generateApiKey();