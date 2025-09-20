# Quick Setup Guide

## Prerequisites
- Node.js 18+
- Cloudflare account with Enterprise plan
- Google AI API key for Gemini
- GitHub account

## Step-by-Step Setup

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/cuteBirdSlopMachine.git
cd cuteBirdSlopMachine
npm install
```

### 2. Configure GitHub Repository

#### Create GitHub Environments
1. Go to Settings → Environments
2. Create `production` environment
3. Create `preview` environment

#### Add Repository Secrets
Settings → Secrets and variables → Actions → Repository secrets:
- `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `CLOUDFLARE_ZONE` - Your domain (e.g., example.com)

### 3. Run Infrastructure Setup

1. Go to Actions tab in GitHub
2. Select "Infrastructure Setup" workflow
3. Click "Run workflow"
4. Copy the output IDs (KV namespace, D1 database)

### 4. Configure Local Environment

```bash
# Generate API keys
npm run generate-api-key  # Save for production
npm run generate-api-key  # Save for preview (different key)

# Configure wrangler.toml
npm run setup
# Enter the IDs from step 3 when prompted

# Create .env file
cp .env.example .env
# Edit .env with your keys
```

### 5. Add Environment Secrets to GitHub

#### Production Environment Secrets
Settings → Environments → production → Add secret:
- `GOOGLE_AI_API_KEY` - Your production Gemini API key
- `WORKER_API_KEY` - The first key you generated

#### Preview Environment Secrets
Settings → Environments → preview → Add secret:
- `GOOGLE_AI_API_KEY` - Your dev/staging Gemini API key
- `WORKER_API_KEY` - The second key you generated

### 6. Test Locally

```bash
npm run dev
# Open http://localhost:8787/health
```

### 7. Deploy to Production

```bash
git push origin master
# GitHub Actions will automatically deploy
```

## Testing with Bruno

1. Install [Bruno](https://www.usebruno.com/)
2. Open Bruno and import collection: File → Open Collection → Select `bruno-collection` folder
3. Set environment variables in Bruno:
   - Click environment dropdown → Edit
   - Set `WORKER_API_KEY` to your generated key
4. Test endpoints:
   - Health Check (should work without auth)
   - Generate Prompts (requires API key)

## Troubleshooting

### Infrastructure workflow fails
- Check Cloudflare API token has correct permissions
- Verify Enterprise plan is active

### Local development errors
- Ensure wrangler.toml is configured (not using .example)
- Check .env file has all required keys
- Try `rm -rf .wrangler` and restart

### Deployment fails
- Verify all GitHub secrets are set
- Check wrangler.toml has valid resource IDs
- Review GitHub Actions logs for specific errors

## Common Commands

```bash
npm run dev              # Start local development
npm run deploy           # Manual deployment
npm run generate-api-key # Generate new API key
npm run setup           # Configure wrangler.toml
npm run tail            # View production logs
```