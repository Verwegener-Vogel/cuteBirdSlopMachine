import { test, expect } from '@playwright/test';

test.describe('Cute Bird Slop Machine - Manual Testing', () => {
  const baseURL = 'http://localhost:8787';

  test('should load the gallery UI', async ({ page }) => {
    await page.goto(baseURL);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for main heading
    await expect(page.locator('h1')).toContainText('Cute Bird Slop Machine');

    // Take screenshot
    await page.screenshot({ path: '/tmp/gallery-ui.png', fullPage: true });
    console.log('Screenshot saved to /tmp/gallery-ui.png');
  });

  test('should display video gallery', async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Check for video cards
    const videoCards = page.locator('.video-card, video, [data-video-id]');
    const count = await videoCards.count();

    console.log(`Found ${count} video elements`);
    expect(count).toBeGreaterThan(0);
  });

  test('should play a video', async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Find first video element
    const video = page.locator('video').first();

    if (await video.count() > 0) {
      // Check video source
      const src = await video.getAttribute('src');
      console.log('Video source:', src);

      // Wait for video to be ready
      await video.waitFor({ state: 'visible' });

      // Try to play
      await video.click();

      // Wait a bit to ensure video starts
      await page.waitForTimeout(2000);

      // Check if playing
      const isPaused = await video.evaluate((v: HTMLVideoElement) => v.paused);
      console.log('Video paused:', isPaused);

      // Take screenshot of playing video
      await page.screenshot({ path: '/tmp/video-playing.png' });
      console.log('Screenshot saved to /tmp/video-playing.png');
    } else {
      console.log('No video elements found');
    }
  });

  test('should navigate to prompts tab', async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Look for prompts tab/button
    const promptsTab = page.getByText('Prompts', { exact: false }).first();

    if (await promptsTab.count() > 0) {
      await promptsTab.click();
      await page.waitForTimeout(500);

      // Take screenshot
      await page.screenshot({ path: '/tmp/prompts-tab.png', fullPage: true });
      console.log('Screenshot saved to /tmp/prompts-tab.png');
    }
  });

  test('should check video streaming endpoint', async ({ page }) => {
    // Get a video ID from the API
    const response = await page.request.get(`${baseURL}/videos`);
    const data = await response.json();

    if (data.videos && data.videos.length > 0) {
      const videoId = data.videos[0].id;
      console.log('Testing video ID:', videoId);

      // Try to access stream endpoint
      const streamResponse = await page.request.get(`${baseURL}/videos/${videoId}/stream`);
      console.log('Stream response status:', streamResponse.status());
      console.log('Stream content-type:', streamResponse.headers()['content-type']);

      // Should return video
      expect(streamResponse.status()).toBeLessThan(400);
    }
  });

  test('should display health status', async ({ page }) => {
    const response = await page.request.get(`${baseURL}/health`);
    const data = await response.json();

    console.log('Health check:', data);
    expect(data.status).toBe('healthy');
    expect(data.service).toBe('Cute Bird Slop Machine');
  });
});
