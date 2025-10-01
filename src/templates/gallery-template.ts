/**
 * Gallery Template Generator
 * Generates the main UI with video gallery and prompt management
 */

export interface VideoData {
  id: string;
  status: string;
  video_url: string | null;
  r2_key: string | null;
  prompt_id: string | null;
  prompt: string | null;
  cuteness_score: number | null;
}

export interface PromptData {
  id: string;
  prompt: string;
  cuteness_score: number | null;
  alignment_score: number | null;
  visual_appeal_score: number | null;
  uniqueness_score: number | null;
  species: string | null;
  tags: string | null;
  created_at: number;
  video_count: number;
}

export interface GalleryTemplateData {
  videos: VideoData[];
  prompts: PromptData[];
}

export function galleryTemplate(data: GalleryTemplateData): string {
  const { videos, prompts } = data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🐦 Cute Bird Slop Machine</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
            --primary-green: #017d1d;
            --accent-yellow: #ced067;
            --accent-hover: #b6b84c;
            --bg-cream: #f2efe8;
            --footer-dark: #22343a;
            --text-dark: #3a4145;
            --text-light: #bbc7cc;
            --card-shadow: 0 4px 12px rgba(0,0,0,0.1);
            --card-hover-shadow: 0 8px 20px rgba(1,125,29,0.2);
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: var(--bg-cream);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1600px;
            margin: 0 auto;
        }

        /* Header */
        .header {
            text-align: center;
            margin-bottom: 40px;
            animation: fadeInDown 0.8s ease;
        }

        h1 {
            color: var(--primary-green);
            font-size: clamp(2rem, 5vw, 3rem);
            margin-bottom: 10px;
        }

        .subtitle {
            color: var(--text-dark);
            font-size: 1.1em;
            margin-bottom: 20px;
        }

        /* Tab Navigation */
        .tab-nav {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-bottom: 30px;
        }

        .tab-button {
            background: white;
            color: var(--text-dark);
            border: 2px solid var(--text-light);
            padding: 12px 30px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
        }

        .tab-button:hover {
            border-color: var(--accent-yellow);
            transform: translateY(-2px);
        }

        .tab-button.active {
            background: var(--primary-green);
            color: white;
            border-color: var(--primary-green);
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
            animation: fadeIn 0.5s ease;
        }

        /* Stats Bar */
        .stats-bar {
            background: white;
            border-radius: 15px;
            padding: 20px;
            display: flex;
            justify-content: space-around;
            margin-bottom: 30px;
            box-shadow: var(--card-shadow);
            animation: fadeIn 0.8s ease 0.2s both;
        }

        .stat {
            text-align: center;
            color: var(--text-dark);
        }

        .stat strong {
            display: block;
            font-size: 2em;
            margin-bottom: 5px;
            color: var(--primary-green);
        }

        /* Video Grid */
        .video-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 25px;
            animation: fadeInUp 0.8s ease 0.4s both;
        }

        .video-card {
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: var(--card-shadow);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            animation: scaleIn 0.5s ease both;
        }

        .video-card:hover {
            transform: translateY(-8px) scale(1.02);
            box-shadow: var(--card-hover-shadow);
            border-color: var(--accent-yellow);
        }

        .video-container {
            position: relative;
            background: var(--footer-dark);
            aspect-ratio: 16/9;
        }

        .video-player {
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #000;
        }

        .video-error {
            display: none;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            text-align: center;
            padding: 20px;
            background: rgba(0,0,0,0.8);
            border-radius: 10px;
        }

        .video-info {
            padding: 20px;
        }

        .video-prompt {
            font-size: 0.95em;
            color: var(--text-dark);
            margin-bottom: 15px;
            line-height: 1.5;
        }

        .video-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--bg-cream);
        }

        .cuteness-badge {
            background: var(--accent-yellow);
            color: var(--text-dark);
            padding: 6px 15px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 0.9em;
        }

        .video-status {
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: bold;
        }

        .status-downloaded { background: #d4edda; color: #155724; }

        .video-actions {
            display: flex;
            gap: 10px;
        }

        .action-btn {
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 10px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 0.9em;
        }

        .download-btn {
            background: var(--primary-green);
            color: white;
        }

        .download-btn:hover {
            transform: translateY(-2px);
            background: var(--accent-hover);
        }

        .share-btn {
            background: var(--accent-yellow);
            color: var(--text-dark);
        }

        .share-btn:hover {
            transform: translateY(-2px);
            background: var(--accent-hover);
        }

        /* Prompts Section */
        .prompts-controls {
            text-align: center;
            margin-bottom: 30px;
        }

        .generate-btn {
            background: var(--primary-green);
            color: white;
            border: none;
            padding: 15px 40px;
            border-radius: 30px;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: var(--card-shadow);
        }

        .generate-btn:hover {
            transform: translateY(-3px);
            background: var(--accent-hover);
            box-shadow: var(--card-hover-shadow);
        }

        .generate-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .prompts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
            animation: fadeInUp 0.8s ease 0.2s both;
        }

        .prompt-card {
            background: white;
            border-radius: 15px;
            padding: 20px;
            box-shadow: var(--card-shadow);
            transition: all 0.3s;
            cursor: pointer;
        }

        .prompt-card:hover {
            transform: translateY(-5px);
            box-shadow: var(--card-hover-shadow);
        }

        .prompt-text {
            font-size: 15px;
            color: var(--text-dark);
            margin-bottom: 15px;
            line-height: 1.5;
        }

        .prompt-scores {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 15px;
        }

        .score-item {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            color: var(--text-light);
        }

        .score-value {
            font-weight: bold;
            color: var(--primary-green);
        }

        .prompt-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid var(--bg-cream);
        }

        .prompt-tags {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
        }

        .tag {
            background: rgba(1, 125, 29, 0.1);
            color: var(--primary-green);
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
        }

        .generate-video-btn {
            background: var(--accent-yellow);
            color: var(--text-dark);
            border: none;
            padding: 8px 20px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
        }

        .generate-video-btn:hover {
            transform: translateY(-2px);
            background: var(--accent-hover);
        }

        .generate-video-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .generate-video-btn.video-created {
            background: var(--primary-green);
            color: white;
        }

        .no-videos {
            text-align: center;
            padding: 60px 20px;
            color: var(--text-dark);
            font-size: 1.2em;
            grid-column: 1 / -1;
        }

        /* Animations */
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-30px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🐦 Cute Bird Slop Machine</h1>
            <p class="subtitle">Adorable AI-generated Baltic coastal bird content</p>
        </div>

        <div class="stats-bar">
            <div class="stat">
                <strong>${videos.length}</strong>
                Videos Available
            </div>
            <div class="stat">
                <strong>${prompts.length}</strong>
                Prompts Created
            </div>
            <div class="stat">
                <strong>${(videos.reduce((acc, v) => acc + (v.cuteness_score || 0), 0) / Math.max(videos.length, 1)).toFixed(1)}</strong>
                Avg Cuteness
            </div>
        </div>

        <!-- Tab Navigation -->
        <div class="tab-nav">
            <button class="tab-button active" onclick="switchTab('videos')">🎬 Videos</button>
            <button class="tab-button" onclick="switchTab('prompts')">💡 Prompts</button>
        </div>

        <!-- Videos Tab -->
        <div id="videos-tab" class="tab-content active">
            <div class="video-grid">
            ${videos.length === 0 ?
              '<div class="no-videos">🎬 No videos available yet<br><br>Start generating some adorable Baltic bird content!</div>' :
              videos.map((v, index) => {
                const videoUrl = `/videos/${v.id}/stream`;
                const downloadUrl = `/videos/${v.id}/download`;
                const animationDelay = index * 0.1;
                return `
                <div class="video-card" style="animation-delay: ${animationDelay}s" data-video-id="${v.id}">
                    <div class="video-container">
                        <video class="video-player"
                               data-video-id="${v.id}"
                               data-src="${videoUrl}"
                               controls
                               preload="metadata"
                               onerror="handleVideoError(this)"
                               onloadedmetadata="handleVideoLoad(this)">
                        </video>
                        <div class="video-error">
                            <p>⚠️ Failed to load video</p>
                            <button onclick="retryVideo('${v.id}')" style="margin-top: 10px; padding: 8px 16px; background: white; border: none; border-radius: 5px; cursor: pointer;">Retry</button>
                        </div>
                    </div>
                    <div class="video-info">
                        <p class="video-prompt">${v.prompt || 'No prompt available'}</p>
                        <div class="video-meta">
                            ${v.cuteness_score ? `<span class="cuteness-badge">😍 ${v.cuteness_score.toFixed(1)}/10</span>` : ''}
                            <span class="video-status status-downloaded">Downloaded</span>
                        </div>
                        <div class="video-actions">
                            <a href="${downloadUrl}" download class="action-btn download-btn">⬇️ Download</a>
                            <button onclick="shareVideo('${v.id}')" class="action-btn share-btn">🔗 Share</button>
                        </div>
                    </div>
                </div>
                `;
              }).join('')}
            </div>
        </div>

        <!-- Prompts Tab -->
        <div id="prompts-tab" class="tab-content">
            <div class="prompts-controls">
                <button class="generate-btn" onclick="generatePrompts()">
                    ✨ Generate New Prompts
                </button>
            </div>

            <div class="prompts-grid">
                ${prompts.length === 0 ?
                  '<div class="no-videos">💡 No prompts available yet<br><br>Click the button above to generate some!</div>' :
                  prompts.map((p) => {
                    const hasVideo = p.video_count > 0;
                    const tagsArray = typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags || [];
                    const speciesArray = typeof p.species === 'string' ? JSON.parse(p.species) : p.species || [];
                    return `
                    <div class="prompt-card" data-prompt-id="${p.id}">
                        <div class="prompt-text">${p.prompt}</div>
                        <div class="prompt-scores">
                            <div class="score-item">
                                <span>Cuteness:</span>
                                <span class="score-value">${p.cuteness_score?.toFixed(1) || 'N/A'}</span>
                            </div>
                            <div class="score-item">
                                <span>Alignment:</span>
                                <span class="score-value">${p.alignment_score?.toFixed(1) || 'N/A'}</span>
                            </div>
                            <div class="score-item">
                                <span>Visual:</span>
                                <span class="score-value">${p.visual_appeal_score?.toFixed(1) || 'N/A'}</span>
                            </div>
                            <div class="score-item">
                                <span>Unique:</span>
                                <span class="score-value">${p.uniqueness_score?.toFixed(1) || 'N/A'}</span>
                            </div>
                        </div>
                        <div class="prompt-meta">
                            <div class="prompt-tags">
                                ${speciesArray.map((s: string) => `<span class="tag">🐦 ${s}</span>`).join('')}
                                ${tagsArray.slice(0, 2).map((t: string) => `<span class="tag">${t}</span>`).join('')}
                            </div>
                            <button class="generate-video-btn ${hasVideo ? 'video-created' : ''}"
                                    data-prompt-id="${p.id}"
                                    data-prompt-text="${p.prompt.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}"
                                    data-has-video="${hasVideo}"
                                    onclick="handleVideoButtonClick(this)">
                                ${hasVideo ? '▶️ Play Video' : '🎬 Generate Video'}
                            </button>
                        </div>
                    </div>
                    `;
                  }).join('')}
            </div>
        </div>
    </div>

    <script>
        // Lazy load videos when they come into view
        const videoObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const video = entry.target;
                    loadVideo(video);
                    videoObserver.unobserve(video);
                }
            });
        }, { rootMargin: '50px' });

        document.querySelectorAll('.video-player').forEach(video => {
            videoObserver.observe(video);
        });

        function loadVideo(video) {
            const src = video.dataset.src;
            if (src && !video.src) {
                video.src = src;
                video.load();
            }
        }

        function handleVideoError(video) {
            const card = video.closest('.video-card');
            const errorDiv = card.querySelector('.video-error');
            if (errorDiv) {
                errorDiv.style.display = 'block';
            }
        }

        function handleVideoLoad(video) {
            const card = video.closest('.video-card');
            const durationSpan = card.querySelector('.video-duration');
            if (durationSpan && video.duration) {
                const minutes = Math.floor(video.duration / 60);
                const seconds = Math.floor(video.duration % 60);
                durationSpan.textContent = minutes + ':' + seconds.toString().padStart(2, '0');
            }
        }

        function retryVideo(videoId) {
            const card = document.querySelector('.video-card[data-video-id="' + videoId + '"]');
            const video = card.querySelector('.video-player');
            const error = card.querySelector('.video-error');

            error.style.display = 'none';
            video.load();
        }

        function shareVideo(videoId) {
            const url = window.location.origin + '/videos/' + videoId + '/stream';

            if (navigator.share) {
                navigator.share({
                    title: 'Cute Bird Video',
                    text: 'Check out this adorable bird video!',
                    url: url
                }).catch(err => console.log('Share failed:', err));
            } else {
                navigator.clipboard.writeText(url).then(() => {
                    showToast('Link copied to clipboard!');
                });
            }
        }

        function showToast(message) {
            const toast = document.createElement('div');
            toast.textContent = message;
            toast.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 15px 30px; border-radius: 25px; z-index: 1000; animation: fadeIn 0.3s ease;';
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        // Tab switching
        function switchTab(tabName) {
            if (tabName !== 'videos') {
                document.querySelectorAll('.video-player').forEach(video => {
                    if (!video.paused) {
                        video.pause();
                    }
                });
            }

            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            event.target.classList.add('active');
            document.getElementById(tabName + '-tab').classList.add('active');
        }

        function handleVideoButtonClick(button) {
            const promptId = button.dataset.promptId;
            const promptText = button.dataset.promptText;
            const hasVideo = button.dataset.hasVideo === 'true';

            if (hasVideo) {
                playExistingVideo(promptId);
            } else {
                generateVideoFromPrompt(promptId, promptText);
            }
        }

        async function generatePrompts() {
            const button = event.target;
            button.disabled = true;
            button.textContent = '⏳ Generating...';

            try {
                const response = await fetch('/generate-prompts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': 'test-worker-key'
                    },
                    body: JSON.stringify({})
                });

                if (response.ok) {
                    const result = await response.json();
                    showToast('✅ Generated ' + result.promptsGenerated + ' new prompts!');
                    setTimeout(() => {
                        window.location.href = window.location.href;
                    }, 3000);
                } else {
                    const error = await response.text();
                    showToast('❌ Failed: ' + error);
                    button.disabled = false;
                    button.textContent = '✨ Generate New Prompts';
                }
            } catch (error) {
                showToast('❌ Error: ' + error.message);
                button.disabled = false;
                button.textContent = '✨ Generate New Prompts';
            }
        }

        async function generateVideoFromPrompt(promptId, promptText) {
            const button = event.target;
            button.disabled = true;
            button.textContent = '⏳ Generating...';

            try {
                const response = await fetch('/generate-video', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': 'test-worker-key'
                    },
                    body: JSON.stringify({
                        promptId: promptId,
                        prompt: promptText,
                        style: 'realistic',
                        duration: 15,
                        includeSound: true
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    showToast('🎬 Video generation started! ID: ' + result.videoId);
                    button.textContent = '✓ Video Queued';
                    setTimeout(() => checkVideoStatus(result.videoId), 5000);
                } else {
                    const error = await response.text();
                    showToast('❌ Failed: ' + error);
                    button.disabled = false;
                    button.textContent = '🎬 Generate Video';
                }
            } catch (error) {
                showToast('❌ Error: ' + error.message);
                button.disabled = false;
                button.textContent = '🎬 Generate Video';
            }
        }

        async function checkVideoStatus(videoId) {
            try {
                const response = await fetch('/videos/' + videoId);
                const video = await response.json();

                if (video.status === 'downloaded') {
                    showToast('🎉 Video ready to play!');
                    const promptId = video.prompt_id;
                    const button = document.querySelector('[data-prompt-id="' + promptId + '"] button');
                    if (button) {
                        button.textContent = '▶️ Play Video';
                        button.className = 'generate-video-btn video-created';
                        button.dataset.hasVideo = 'true';
                        button.disabled = false;
                    }
                } else if (video.status === 'failed') {
                    showToast('❌ Video generation failed');
                    const promptId = video.prompt_id;
                    const button = document.querySelector('[data-prompt-id="' + promptId + '"] button');
                    if (button) {
                        button.textContent = '🎬 Generate Video';
                        button.disabled = false;
                    }
                } else {
                    setTimeout(() => checkVideoStatus(videoId), 10000);
                }
            } catch (error) {
                console.error('Status check failed:', error);
                setTimeout(() => checkVideoStatus(videoId), 15000);
            }
        }

        function playExistingVideo(promptId) {
            try {
                const currentPromptContainer = document.querySelector('[data-prompt-id="' + promptId + '"]');
                const currentPromptText = currentPromptContainer?.querySelector('.prompt-text')?.textContent?.trim();

                switchTab('videos');

                setTimeout(() => {
                    const videoContainers = document.querySelectorAll('.video-card');
                    let targetVideo = null;
                    let bestMatch = null;

                    for (const container of videoContainers) {
                        const promptElement = container.querySelector('.video-prompt');
                        const videoPlayer = container.querySelector('.video-player');

                        if (promptElement && videoPlayer) {
                            const videoPromptText = promptElement.textContent?.trim();

                            if (currentPromptText && videoPromptText === currentPromptText) {
                                targetVideo = videoPlayer;
                                break;
                            }

                            if (!bestMatch && videoPlayer.dataset && videoPlayer.dataset.videoId) {
                                bestMatch = videoPlayer;
                            }
                        }
                    }

                    if (!targetVideo && bestMatch) {
                        targetVideo = bestMatch;
                    }

                    if (targetVideo) {
                        targetVideo.scrollIntoView({ behavior: 'smooth', block: 'center' });

                        if (!targetVideo.src || targetVideo.src === '') {
                            loadVideo(targetVideo);
                        }

                        setTimeout(() => {
                            targetVideo.play().catch(() => {
                                console.log('Autoplay blocked - user will need to click play');
                            });
                        }, 1000);

                        showToast('Displaying cuteness');
                    } else {
                        showToast('❌ No videos available in gallery');
                    }
                }, 500);
            } catch (error) {
                console.error('Failed to find video:', error);
                showToast('❌ Error finding video');
            }
        }

        // Auto-poll pending videos every 15 seconds for local development
        setInterval(async () => {
            try {
                // Check if there are any pending videos
                const videosResponse = await fetch('/videos');
                const videosData = await videosResponse.json();
                const hasPending = videosData.videos?.some(v => v.status === 'pending');

                if (hasPending) {
                    console.log('Polling pending videos...');
                    const pollResponse = await fetch('/poll-videos');
                    const pollData = await pollResponse.json();
                    if (pollData.success) {
                        console.log(pollData.message);
                        // Reload page if videos were processed
                        if (pollData.message && pollData.message.includes('Processed') && !pollData.message.includes('0')) {
                            console.log('Videos completed, reloading page...');
                            location.reload();
                        }
                    }
                }
            } catch (error) {
                console.error('Auto-poll error:', error);
            }
        }, 15000);
    </script>
</body>
</html>`;
}
