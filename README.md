# Cute Bird Slop Machine

An AI-powered video generation system that creates adorable bird content featuring Northern German Baltic coastal species.

## Overview

This project generates unique AI videos of local birds using Google's Gemini API, combining realistic and cartoon-like aesthetics. The system runs on Cloudflare Workers, utilizing enterprise features for optimal performance and scalability.

## Features

- Automated bird video generation using Gemini AI
- Intelligent prompt generation with cuteness rating system
- Persistent prompt storage to ensure uniqueness
- Focus on Baltic coastal bird species
- Mixed realistic and cartoon rendering styles
- Built for Cloudflare Workers infrastructure

## Technical Stack

- Runtime: Cloudflare Workers
- AI Model: Google Gemini 2.5 Pro
- Video Generation: Google AI Video API
- Storage: Cloudflare KV/D1 for prompt persistence
- Language: TypeScript/JavaScript

## Project Goals

1. Generate maximum volume of cute bird AI content
2. Focus on Northern German Baltic coastal bird species
3. Maintain prompt uniqueness through persistent storage
4. Rate content for cuteness potential
5. Build expandable prompt generation dataset

## Getting Started

### Prerequisites

- Cloudflare account with Workers access
- Google AI API key with Gemini access
- Node.js 18+ for local development

### Installation

```bash
git clone https://github.com/yourusername/cuteBirdSlopMachine.git
cd cuteBirdSlopMachine
npm install
```

### Configuration

1. Copy `.env.example` to `.env`
2. Add your Google AI API key
3. Configure Cloudflare credentials

```bash
cp .env.example .env
# Edit .env with your credentials
```

### Development

```bash
npm run dev
```

### Deployment

```bash
npm run deploy
```

## Architecture

The system consists of:

- **Prompt Generator**: Creates unique bird video prompts
- **Cuteness Rater**: Evaluates prompts for alignment and appeal
- **Video Generator**: Interfaces with Gemini AI for video creation
- **Storage Layer**: Persists prompts and prevents duplicates
- **API Endpoints**: RESTful interface for video generation

## API Endpoints

- `POST /generate` - Generate new bird videos
- `GET /prompts` - Retrieve saved prompts
- `GET /videos/:id` - Get specific video
- `POST /rate` - Rate prompts for cuteness

## Contributing

Please ensure all contributions align with the project's goal of maximizing cute bird content generation.

## Deployment & CI/CD

### GitHub Actions Workflows

The project includes comprehensive CI/CD automation:

#### 1. Infrastructure Setup (`infrastructure.yml`)
- **Trigger**: Manual or when infrastructure files change
- **Purpose**: Creates Cloudflare resources (D1 database, KV namespaces, queues)
- **Usage**: Run once during initial setup or when adding new resources

#### 2. Deployment Pipeline (`deploy.yml`)
- **Production**: Automatic deployment on push to master branch
- **Preview**: Creates isolated deployments for each pull request
- **Features**:
  - TypeScript validation
  - Dry-run testing before deployment
  - Automatic preview URL comments on PRs
  - Cleanup of preview environments on PR close

#### 3. Scheduled Prompt Generation (`scheduled.yml`)
- **Schedule**: Runs every 6 hours automatically
- **Purpose**: Generates fresh bird prompts to maintain content pipeline
- **Manual Trigger**: Can be run manually with custom batch count

### Required GitHub Secrets

GitHub supports environment-specific secrets. Configure these in Settings → Secrets and variables → Actions:

#### Repository Secrets (shared across environments)
```
CLOUDFLARE_API_TOKEN      # Cloudflare API token with Worker permissions
CLOUDFLARE_ACCOUNT_ID     # Your Cloudflare account ID
CLOUDFLARE_ZONE          # Your domain (e.g., example.com)
```

#### Environment Secrets
Create two environments: `production` and `preview`

**Production Environment:**
```
GOOGLE_AI_API_KEY        # Production Google AI API key
WORKER_API_KEY          # Production API key (generate with: npm run generate-api-key)
```

**Preview Environment:**
```
GOOGLE_AI_API_KEY        # Development/staging Google AI API key (can be same or different)
WORKER_API_KEY          # Preview API key (should be different from production)
```

### Generating the Worker API Key

The WORKER_API_KEY is a custom authentication token that protects your API endpoints from public abuse:

```bash
npm run generate-api-key
```

This generates a cryptographically secure 32-byte key. Use different keys for each environment.

### Deployment Environments

- **Production**: `https://cute-bird-slop-machine.YOUR_DOMAIN.workers.dev`
- **Preview**: `https://cute-bird-slop-machine-pr-{number}.YOUR_DOMAIN.workers.dev`
- **Local**: `http://localhost:8787` (via `npm run dev`)

### First-Time Setup

1. Fork/clone repository
2. Add required secrets to GitHub (see secrets section above)
3. Run infrastructure workflow to create Cloudflare resources
4. Configure wrangler.toml with resource IDs:
   ```bash
   npm run setup  # Interactive setup
   # OR copy manually:
   cp wrangler.toml.example wrangler.toml
   # Then edit with your IDs from infrastructure workflow output
   ```
5. Generate API keys:
   ```bash
   npm run generate-api-key  # For production
   npm run generate-api-key  # Different one for preview
   ```
6. Add API keys to GitHub environment secrets
7. Push to master to trigger first deployment

**Note**: `wrangler.toml` is gitignored since it contains your specific resource IDs. The template `wrangler.toml.example` is committed for reference.

## Testing

### Bruno API Collection

The project includes a complete Bruno collection for API testing:

1. Install [Bruno](https://www.usebruno.com/) for macOS
2. Open the `bruno-collection` folder in Bruno
3. Select environment (local/production)
4. Run individual requests or the full collection

Available test endpoints:
- Health Check - Verify service status
- Generate Prompts - Create 10 new bird prompts
- Get Top Prompts - Retrieve highest-rated prompts
- Generate Video - Queue video generation
- Get Video Status - Check video processing status

## License

MIT