#!/usr/bin/env node

/**
 * Post-Deployment Smoke Tests
 *
 * Validates critical endpoints after deployment to ensure:
 * - Service is accessible
 * - Core functionality works
 * - No critical regressions
 *
 * Usage:
 *   npm run test:smoke
 *   npm run test:smoke -- --env=production
 *   npm run test:smoke -- --env=preview
 *   npm run test:smoke -- --url=https://custom-url.workers.dev
 */

const https = require('https');
const http = require('http');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Configuration
const args = process.argv.slice(2);
const envArg = args.find(arg => arg.startsWith('--env='));
const urlArg = args.find(arg => arg.startsWith('--url='));
const apiKeyArg = args.find(arg => arg.startsWith('--api-key='));

const environment = envArg ? envArg.split('=')[1] : 'local';
const customUrl = urlArg ? urlArg.split('=')[1] : null;
const apiKey = apiKeyArg ? apiKeyArg.split('=')[1] : process.env.WORKER_API_KEY;

// Environment URLs
const URLS = {
  local: 'http://localhost:8787',
  preview: process.env.PREVIEW_URL || 'https://cute-bird-slop-machine-preview.workers.dev',
  production: process.env.PRODUCTION_URL || 'https://cute-bird-slop-machine.workers.dev',
};

const BASE_URL = customUrl || URLS[environment] || URLS.local;

// Test configuration
const TIMEOUT = 10000; // 10 seconds
let testsPassed = 0;
let testsFailed = 0;
let testsSkipped = 0;

// HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => {
      reject(new Error(`Request timeout after ${TIMEOUT}ms`));
    }, TIMEOUT);

    const req = protocol.request(url, options, (res) => {
      clearTimeout(timeout);
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// Test runner
async function runTest(name, testFn, skip = false) {
  if (skip) {
    log(`⊘ SKIP: ${name}`, 'gray');
    testsSkipped++;
    return;
  }

  try {
    await testFn();
    log(`✓ PASS: ${name}`, 'green');
    testsPassed++;
  } catch (error) {
    log(`✗ FAIL: ${name}`, 'red');
    log(`  Error: ${error.message}`, 'red');
    testsFailed++;
  }
}

// Helper to parse JSON safely
function parseJSON(body) {
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Invalid JSON response: ${body.substring(0, 100)}...`);
  }
}

// Test suites
async function testHealth() {
  const response = await makeRequest(`${BASE_URL}/health`);

  if (response.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${response.statusCode}`);
  }

  const data = parseJSON(response.body);

  if (data.status !== 'healthy') {
    throw new Error(`Expected status "healthy", got "${data.status}"`);
  }

  if (!data.service) {
    throw new Error('Missing service name in response');
  }

  if (!data.timestamp) {
    throw new Error('Missing timestamp in response');
  }
}

async function testPromptsEndpoint() {
  const response = await makeRequest(`${BASE_URL}/prompts?limit=5`);

  if (response.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${response.statusCode}`);
  }

  const data = parseJSON(response.body);

  if (!data.success) {
    throw new Error('Expected success: true');
  }

  if (!Array.isArray(data.prompts)) {
    throw new Error('Expected prompts array');
  }
}

async function testVideoStatus() {
  const response = await makeRequest(`${BASE_URL}/video-status`);

  if (response.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${response.statusCode}`);
  }

  const data = parseJSON(response.body);

  if (!data.summary) {
    throw new Error('Expected summary object');
  }

  if (typeof data.summary.total !== 'number') {
    throw new Error('Expected summary.total to be a number');
  }

  if (!Array.isArray(data.videos)) {
    throw new Error('Expected videos array');
  }
}

async function testVideosEndpoint() {
  const response = await makeRequest(`${BASE_URL}/videos`);

  if (response.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${response.statusCode}`);
  }

  const data = parseJSON(response.body);

  if (typeof data.totalVideos !== 'number') {
    throw new Error('Expected totalVideos to be a number');
  }

  if (!Array.isArray(data.videos)) {
    throw new Error('Expected videos array');
  }
}

async function testVideoGalleryHTML() {
  const response = await makeRequest(`${BASE_URL}/videos.html`);

  if (response.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${response.statusCode}`);
  }

  if (!response.headers['content-type']?.includes('text/html')) {
    throw new Error(`Expected content-type text/html, got ${response.headers['content-type']}`);
  }

  if (!response.body.includes('<!DOCTYPE html>')) {
    throw new Error('Response does not appear to be HTML');
  }

  if (!response.body.includes('Cute Bird Slop Machine')) {
    throw new Error('HTML missing expected title');
  }
}

async function testGeneratePromptsAuth() {
  // Test without API key - should fail
  const response = await makeRequest(`${BASE_URL}/generate-prompts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (environment !== 'local' && response.statusCode !== 401) {
    throw new Error(`Expected status 401 (unauthorized), got ${response.statusCode}`);
  }
}

async function testGeneratePromptsWithKey() {
  if (!apiKey) {
    throw new Error('API key required for this test. Set WORKER_API_KEY env var or use --api-key flag');
  }

  const response = await makeRequest(`${BASE_URL}/generate-prompts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({}),
  });

  if (response.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${response.statusCode}: ${response.body}`);
  }

  const data = parseJSON(response.body);

  if (!data.success) {
    throw new Error(`Request failed: ${JSON.stringify(data)}`);
  }

  if (!data.batch || !data.batch.ideas) {
    throw new Error('Missing batch or ideas in response');
  }

  if (data.batch.ideas.length !== 10) {
    throw new Error(`Expected 10 prompt ideas, got ${data.batch.ideas.length}`);
  }
}

async function testInvalidEndpoint() {
  const response = await makeRequest(`${BASE_URL}/nonexistent-endpoint`);

  if (response.statusCode !== 404) {
    throw new Error(`Expected status 404, got ${response.statusCode}`);
  }
}

async function testCORS() {
  const response = await makeRequest(`${BASE_URL}/health`, {
    headers: {
      'Origin': 'https://example.com',
    },
  });

  // Check if CORS headers are present (optional, depends on configuration)
  if (response.headers['access-control-allow-origin']) {
    // CORS is enabled, verify it's configured correctly
    log('  ℹ CORS is enabled', 'cyan');
  }
}

async function testResponseTime() {
  const start = Date.now();
  await makeRequest(`${BASE_URL}/health`);
  const duration = Date.now() - start;

  if (duration > 5000) {
    throw new Error(`Response time too slow: ${duration}ms (expected < 5000ms)`);
  }

  log(`  ℹ Response time: ${duration}ms`, 'cyan');
}

// Main test runner
async function main() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('🧪 Post-Deployment Smoke Tests', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');

  log(`Environment: ${environment}`, 'cyan');
  log(`Base URL:    ${BASE_URL}`, 'cyan');
  log(`Timeout:     ${TIMEOUT}ms`, 'cyan');
  log(`API Key:     ${apiKey ? '✓ Provided' : '✗ Not provided'}`, 'cyan');
  log('');

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'yellow');
  log('Running Tests', 'yellow');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'yellow');

  // Core functionality tests
  await runTest('Health endpoint returns healthy status', testHealth);
  await runTest('Response time is acceptable', testResponseTime);
  await runTest('Prompts endpoint returns valid data', testPromptsEndpoint);
  await runTest('Video status endpoint works', testVideoStatus);
  await runTest('Videos endpoint returns data', testVideosEndpoint);
  await runTest('Video gallery HTML renders', testVideoGalleryHTML);

  // Security tests
  await runTest('Generate prompts requires authentication', testGeneratePromptsAuth);
  await runTest(
    'Generate prompts works with valid API key',
    testGeneratePromptsWithKey,
    !apiKey // Skip if no API key
  );

  // Error handling tests
  await runTest('Non-existent endpoint returns 404', testInvalidEndpoint);
  await runTest('CORS headers configured (if applicable)', testCORS);

  // Results summary
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('Test Results', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');

  const total = testsPassed + testsFailed + testsSkipped;
  log(`Total:   ${total}`, 'cyan');
  log(`Passed:  ${testsPassed}`, 'green');
  log(`Failed:  ${testsFailed}`, testsFailed > 0 ? 'red' : 'gray');
  log(`Skipped: ${testsSkipped}`, testsSkipped > 0 ? 'yellow' : 'gray');
  log('');

  if (testsFailed > 0) {
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'red');
    log('❌ SMOKE TESTS FAILED', 'red');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'red');
    process.exit(1);
  } else {
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'green');
    log('✅ ALL SMOKE TESTS PASSED', 'green');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'green');
    process.exit(0);
  }
}

// Run tests
main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
