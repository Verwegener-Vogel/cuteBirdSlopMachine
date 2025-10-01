const { chromium } = require('playwright');

async function testVideoGenerationCycle() {
  console.log('🎬 Starting complete video generation cycle test...');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Go to the main page
    console.log('📋 Step 1: Loading main page...');
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');

    // Take a screenshot
    await page.screenshot({ path: 'test-main-page.png' });
    console.log('✅ Main page loaded successfully');

    // Look for a video generation button
    console.log('📋 Step 2: Looking for video generation options...');

    // First, try to find any video generation button or form
    const generateButtons = await page.locator('button:has-text("Generate Video"), button:has-text("Generate"), input[type="submit"]').all();

    if (generateButtons.length === 0) {
      console.log('⚠️  No generate buttons found, checking for prompts...');

      // Check for prompt cards that might have generation capability
      const promptCards = await page.locator('.prompt-card, .video-card, [data-prompt-id]').all();
      console.log(`Found ${promptCards.length} prompt/video cards`);

      if (promptCards.length > 0) {
        // Try to click on first card that might have generation capability
        for (let i = 0; i < Math.min(3, promptCards.length); i++) {
          try {
            console.log(`Checking card ${i + 1}...`);
            await promptCards[i].click();
            await page.waitForTimeout(1000);

            // Look for generate button after clicking
            const generateButton = await page.locator('button:has-text("Generate Video"), button:has-text("Generate")').first();
            if (await generateButton.isVisible()) {
              console.log('✅ Found generate button after clicking card');
              break;
            }
          } catch (e) {
            console.log(`Card ${i + 1} not clickable, trying next...`);
          }
        }
      }
    }

    // Look for a generate button again
    const generateButton = await page.locator('button:has-text("Generate Video"), button:has-text("Generate")').first();

    if (await generateButton.isVisible()) {
      console.log('📋 Step 3: Clicking generate video button...');
      await generateButton.click();
      console.log('✅ Generate button clicked');

      // Wait for some indication that generation started
      await page.waitForTimeout(2000);

      // Take screenshot of generation state
      await page.screenshot({ path: 'test-generation-started.png' });

      console.log('📋 Step 4: Monitoring video generation progress...');

      // Look for status changes or progress indicators
      let attempts = 0;
      const maxAttempts = 30; // Wait up to 5 minutes

      while (attempts < maxAttempts) {
        await page.waitForTimeout(10000); // Check every 10 seconds
        attempts++;

        console.log(`Checking progress (attempt ${attempts}/${maxAttempts})...`);

        // Check for "Play Video" button or similar completion indicator
        const playButton = await page.locator('button:has-text("Play Video"), button:has-text("Play"), video').first();

        if (await playButton.isVisible()) {
          console.log('🎉 Video generation completed! Found play button/video element');

          // Take screenshot of completed state
          await page.screenshot({ path: 'test-generation-completed.png' });

          console.log('📋 Step 5: Testing video playback...');

          // Try to play the video
          if (await playButton.isVisible()) {
            await playButton.click();
            console.log('✅ Play button clicked');

            // Wait a bit for video to start
            await page.waitForTimeout(3000);

            // Take final screenshot
            await page.screenshot({ path: 'test-video-playing.png' });
            console.log('🎬 Video playback test completed!');
          }

          break;
        }

        // Check if we're still in generation mode
        const generatingIndicator = await page.locator('text=generating, text=pending, text=queued').first();
        if (await generatingIndicator.isVisible()) {
          console.log('⏳ Still generating... waiting...');
        } else {
          console.log('❓ Unknown state, continuing to wait...');
        }
      }

      if (attempts >= maxAttempts) {
        console.log('⚠️  Video generation did not complete within timeout');
        await page.screenshot({ path: 'test-generation-timeout.png' });
      }

    } else {
      console.log('❌ No generate button found');
      await page.screenshot({ path: 'test-no-generate-button.png' });
    }

    // Check videos tab/section to see all videos
    console.log('📋 Step 6: Checking videos collection...');

    // Try to find videos tab or section
    const videosTab = await page.locator('button:has-text("Videos"), a:has-text("Videos"), [href*="videos"]').first();
    if (await videosTab.isVisible()) {
      await videosTab.click();
      await page.waitForTimeout(2000);
      console.log('✅ Videos tab accessed');

      // Count available videos
      const videoElements = await page.locator('video, .video-card, [data-video-id]').all();
      console.log(`Found ${videoElements.length} video elements in collection`);

      await page.screenshot({ path: 'test-videos-collection.png' });
    }

    console.log('🎉 Complete video generation cycle test finished!');

  } catch (error) {
    console.error('❌ Test error:', error);
    await page.screenshot({ path: 'test-error.png' });
  } finally {
    await browser.close();
  }
}

// Run the test
testVideoGenerationCycle().catch(console.error);