# 🐦 Deployment Guide

## GitHub Actions Setup

This project uses GitHub Actions for automated deployment to Cloudflare Workers.

### Required GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions → New repository secret

#### Cloudflare Credentials
1. **CLOUDFLARE_API_TOKEN** - Cloudflare API token with permissions:
   - Workers Scripts:Edit
   - D1:Edit
   - KV:Edit
   - Queues:Edit
   - Account Settings:Read

   Create at: https://dash.cloudflare.com/profile/api-tokens

2. **CLOUDFLARE_ACCOUNT_ID** - Your Cloudflare Account ID

   Find at: https://dash.cloudflare.com/ (right sidebar)

3. **CLOUDFLARE_ZONE** - Your domain name (e.g., `vogel.yoga`)

#### Application Secrets
4. **GOOGLE_AI_API_KEY** - Google AI/Gemini API key

   Create at: https://aistudio.google.com/apikey

   ⚠️ **NEVER commit this key to git!**

5. **WORKER_API_KEY** - API key for protecting endpoints

   Generate locally:
   ```bash
   npm run generate-api-key
   ```

   ⚠️ **NEVER commit this key to git!**

### Environment Configuration

The workflow needs a GitHub Environment named `production`:
1. Go to Settings → Environments → New environment
2. Name it: `production`
3. (Optional) Add protection rules

### Deployment Process

#### 1. Initial Infrastructure Setup
First time only - run the infrastructure workflow:
```bash
# Trigger via GitHub UI:
Actions → Infrastructure Setup → Run workflow
```

This creates:
- D1 Database (bird-prompts-db)
- KV Namespaces (PROMPTS_KV)
- Message Queues (video-generation-queue)
- R2 Bucket (bird-videos)

**Important:** After running, update `wrangler.toml` with the resource IDs shown in the workflow output.

#### 2. Deploy Application
Push to `main` branch to trigger automatic deployment:
```bash
git push origin main
```

Or manually trigger:
```bash
# Via GitHub UI:
Actions → Deploy to Production → Run workflow
```

### Deployment URL

Your app will be available at:
```
https://cute-bird-slop-machine.<CLOUDFLARE_ZONE>
```

Example: `https://cute-bird-slop-machine.vogel.yoga`

### Health Check

After deployment, verify:
```bash
curl https://cute-bird-slop-machine.<CLOUDFLARE_ZONE>/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-01T12:00:00.000Z",
  "environment": "production"
}
```

## Troubleshooting

### Deployment fails at "Create wrangler.toml"
- Ensure `wrangler.toml.example` exists in repository
- Check that sed commands match your OS (Linux/Mac)

### "Invalid API token" error
- Verify CLOUDFLARE_API_TOKEN has correct permissions
- Check token hasn't expired

### Health check fails
- Wait 10-15 seconds for cold start
- Check Cloudflare Dashboard → Workers → Logs for errors
- Verify all environment variables are set

### Database not found
- Run Infrastructure Setup workflow first
- Update `wrangler.toml` with correct database ID

## Manual Deployment (Local)

For testing or manual deploys:

```bash
# Install dependencies
npm ci

# Deploy to production
npx wrangler deploy --env production

# Check logs
npx wrangler tail
```

## 🔐 Security Best Practices

- Never commit API keys to git
- Use GitHub Secrets for all sensitive values
- Rotate API keys regularly
- Add API restrictions in Google Cloud Console
- Use different keys for dev/prod environments
