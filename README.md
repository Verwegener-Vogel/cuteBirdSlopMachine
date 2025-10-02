# 🐦 Cute Bird Slop Machine

An AI-powered video generation system that creates adorable bird content featuring Northern German Baltic coastal species.

## Overview

This project generates unique AI videos of local birds using Google's Gemini and Veo 3.0 APIs, combining realistic and cartoon-like aesthetics. The system runs on Cloudflare Workers with a beautiful web gallery interface styled to match vogel.yoga branding.

## Features

- 🎬 **Automated Video Generation** - Using Google Veo 3.0 for 10-30 second bird videos
- 💡 **Intelligent Prompt System** - Gemini 2.5 Pro generates rated prompts with cuteness scoring
- 🖼️ **Interactive Gallery** - Modern web UI with video playback and prompt management
- 🗄️ **Persistent Storage** - D1 database ensures prompt uniqueness and video tracking
- 🐦 **Baltic Species Focus** - Features local coastal birds (Eider, Cormorant, Swan, etc.)
- 🎨 **Mixed Rendering Styles** - Balances realistic nature footage with whimsical cartoon aesthetics
- 🌊 **Nature-Inspired Design** - Green color scheme matching vogel.yoga branding

## Technical Stack

- **Runtime**: Cloudflare Workers (Enterprise features)
- **AI Model**: Google Gemini 2.5 Pro (prompts)
- **Video Generation**: Google Veo 3.0 (videos)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (video files)
- **Queue**: Cloudflare Queues (async video processing)
- **Language**: TypeScript

## Architecture

### Core Components

- **Prompt Generator** (`GeminiPromptGenerator`) - Creates unique rated bird prompts
- **Video Generator** (`VeoVideoGenerator`) - Interfaces with Veo 3.0 API
- **Database Service** (`DatabaseService`) - D1 operations with dependency injection
- **Gallery Template** - Server-side rendered UI with lazy-loading videos
- **Queue Consumer** - Async video processing and R2 storage
- **Router System** - Clean endpoint routing with middleware

### Dependency Injection Pattern

The codebase uses interface-based dependency injection for testability:
- All external services (AI, database, storage) implement interfaces
- Mock implementations for unit testing (no real API calls)
- Production services injected at runtime

## Getting Started

### Prerequisites

- Node.js 20+
- Cloudflare account
- Google AI API key with Gemini & Veo access

### Local Development

```bash
# Clone repository
git clone git@github.com:Verwegener-Vogel/cuteBirdSlopMachine.git
cd cuteBirdSlopMachine

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start local server
npm run dev
# Opens at http://localhost:8787
```

### Configuration

Create `.env` file:
```env
GOOGLE_AI_API_KEY=your_google_api_key_here
WORKER_API_KEY=generate_with_npm_run_generate-api-key
ENVIRONMENT=development
```

⚠️ **Never commit API keys to git!**

## API Endpoints

### Public Endpoints
- `GET /` - Gallery UI with video playback
- `GET /health` - Health check
- `GET /prompts` - List top-rated prompts
- `GET /videos` - List all videos
- `GET /videos/{id}` - Get video details
- `GET /videos/{id}/stream` - Stream video (supports range requests)
- `GET /videos/{id}/download` - Download video

### Protected Endpoints (require `X-API-Key` header)
- `POST /generate-prompts` - Generate 10 new rated prompts
- `POST /generate-video` - Queue video generation
- `GET /poll-videos` - Check pending video status

### Development Endpoints
- `POST /scheduled` - Trigger scheduled tasks manually

See `openapi.yaml` for full API specification.

## Deployment

### GitHub Actions

The project uses automated CI/CD:

1. **Infrastructure Setup** (`infrastructure.yml`)
   - One-time: Creates D1, KV, Queues, R2
   - Trigger: Manual via Actions tab

2. **Production Deployment** (`deploy.yml`)
   - Auto-deploys on push to `master`
   - Runs tests, TypeScript checks
   - Health check validation

### Required GitHub Secrets

Configure at: Repository → Settings → Secrets → Actions

**Cloudflare:**
- `CLOUDFLARE_API_TOKEN` - Worker/D1/KV/Queue permissions
- `CLOUDFLARE_ACCOUNT_ID` - From Cloudflare dashboard
- `CLOUDFLARE_ZONE` - Your domain (e.g., `vogel.yoga`)

**Application:**
- `GOOGLE_AI_API_KEY` - From https://aistudio.google.com/apikey
- `WORKER_API_KEY` - Generate: `npm run generate-api-key`

### GitHub Environment

Create environment named `production`:
- Settings → Environments → New environment → `production`

### First Deployment

```bash
# 1. Run infrastructure workflow (GitHub Actions UI)
#    Creates D1 database, KV namespace, Queue, R2 bucket

# 2. Update wrangler.toml with resource IDs from workflow output
npm run setup

# 3. Push to master
git push origin master

# 4. Check deployment
curl https://cute-bird-slop-machine.YOUR_DOMAIN/health
```

See `.github/DEPLOYMENT.md` for detailed instructions.

## Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:run -- test/unit

# Integration tests
npm run test:run -- test/integration

# Coverage report
npm run test:coverage
```

### Testing Strategy
- Unit tests use mock implementations (no real API calls)
- Integration tests validate request/response flows
- All external dependencies are injected interfaces

## Project Structure

```
src/
├── handlers/          # HTTP endpoint handlers
│   ├── health.ts      # Health check
│   ├── prompts.ts     # Prompt generation
│   ├── videos.ts      # Video endpoints
│   ├── ui.ts          # Gallery UI
│   └── queue.ts       # Queue consumer
├── services/          # Business logic
│   ├── ai/            # AI service implementations
│   ├── database.ts    # D1 database operations
│   └── mocks/         # Mock implementations for testing
├── templates/         # HTML templates
│   └── gallery-template.ts
├── utils/             # Utilities
│   ├── router.ts      # Request routing
│   └── schema.sql     # D1 schema
└── index.ts           # Worker entry point
```

## Development Workflow

1. **Local testing**: `npm run dev`
2. **Run tests**: `npm test`
3. **Commit changes** (tests run via husky pre-commit)
4. **Push to master** (triggers deployment)
5. **Monitor logs**: `npx wrangler tail`

## API Testing

### Using Bruno Collection

Import the OpenAPI spec:
```bash
# The bruno-collection folder contains ready-to-use requests
# Open in Bruno API client with 'local' environment selected
```

### Using curl

```bash
# View gallery
curl http://localhost:8787/

# Get prompts
curl http://localhost:8787/prompts

# Generate prompts (requires API key)
curl -X POST http://localhost:8787/generate-prompts \
  -H "X-API-Key: YOUR_WORKER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# Generate video (requires API key)
curl -X POST http://localhost:8787/generate-video \
  -H "X-API-Key: YOUR_WORKER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Cute eider ducklings swimming in Baltic Sea",
    "style": "realistic",
    "duration": 15
  }'
```

## Featured Bird Species

Baltic coastal birds featured in generated content:
- Common Eider (Somateria mollissima)
- Great Cormorant (Phalacrocorax carbo)
- Mute Swan (Cygnus olor)
- Common Tern (Sterna hirundo)
- Eurasian Oystercatcher (Haematopus ostralegus)
- White-tailed Eagle (Haliaeetus albicilla)
- Barnacle Goose (Branta leucopsis)

## Video Generation Details

- **Model**: Veo 3.0 (`veo-3.0-generate-001`)
- **Duration**: 10-30 seconds per video
- **Cost**: $0.75 per second
- **Storage**: Videos retained for 2 days on Google servers
- **R2 Download**: Automatic download to Cloudflare R2 after generation
- **Status Polling**: Async queue-based processing

## Security

🔐 **Critical Security Guidelines:**
- Never commit API keys to git
- Use GitHub Secrets for all sensitive values
- Rotate API keys regularly
- Add API restrictions in Google Cloud Console
- Different keys for dev/prod environments

See `CLAUDE.md` for AI assistant security guidelines.

## Contributing

Ensure contributions align with:
1. Maximum cute bird content generation
2. Baltic coastal species focus
3. Code quality via TypeScript & tests
4. Dependency injection pattern
5. Security best practices

## License

MIT
