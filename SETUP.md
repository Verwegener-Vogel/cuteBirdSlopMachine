# 🚀 Complete Setup Guide

## Overview

This guide walks you through every step to deploy the Cute Bird Slop Machine from scratch.

**Time Required:** ~30 minutes
**Cost:** ~$0 for testing (pay-per-use for video generation)

---

## Part 1: Google Cloud Setup

### 1.1 Create Google AI API Key

1. Go to https://aistudio.google.com/apikey
2. Click **"Create API Key"** (or use existing project)
3. Select your Google Cloud project or create new one
4. Copy the API key (starts with `AIzaSy...`)
5. **Save this key** - you'll need it multiple times

**⚠️ Important:** Add API restrictions for security:
- Go to https://console.cloud.google.com/apis/credentials
- Click your API key
- Under "API restrictions" → Select "Restrict key"
- Enable only:
  - **Generative Language API** (Gemini)
  - **Generativelanguage.googleapis.com** (Veo)

### 1.2 Enable Required APIs

1. Go to https://console.cloud.google.com/apis/library
2. Search and enable:
   - **Generative Language API** (for Gemini prompts)
   - **Vertex AI API** (for Veo video generation)

### 1.3 Check Billing

1. Go to https://console.cloud.google.com/billing
2. Ensure billing is enabled (required for Veo API)
3. Review pricing:
   - Gemini API: Free tier available
   - Veo 3.0: $0.75 per second of video

---

## Part 2: Cloudflare Setup

### 2.1 Create Cloudflare Account (if needed)

1. Go to https://dash.cloudflare.com/sign-up
2. Sign up (free plan works, but Enterprise recommended for best features)

### 2.2 Get Cloudflare Credentials

#### Account ID
1. Go to https://dash.cloudflare.com/
2. Select any website in your account (or skip if none)
3. Look at the right sidebar → **Account ID**
4. Copy this ID (format: `abc123def456...`)

#### API Token
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Use **"Edit Cloudflare Workers"** template
4. Modify permissions:
   ```
   Account - Workers Scripts - Edit
   Account - D1 - Edit
   Account - Workers KV Storage - Edit
   Account - Cloudflare Queues - Edit
   Account - Account Settings - Read
   Zone - Workers Routes - Edit
   ```
5. Set **Account Resources**: Include → Your Account
6. Click **"Continue to summary"** → **"Create Token"**
7. **Copy the token** - you won't see it again!

#### Domain/Zone
- Your domain name (e.g., `vogel.yoga`)
- If you don't have a domain in Cloudflare yet, add one at https://dash.cloudflare.com/

---

## Part 3: GitHub Repository Setup

### 3.1 Configure GitHub Secrets

Go to: https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions

Click **"New repository secret"** for each:

| Secret Name | Value | Where to Get It |
|------------|-------|----------------|
| `CLOUDFLARE_API_TOKEN` | *(your token from Part 2.2)* | From Part 2.2 |
| `CLOUDFLARE_ACCOUNT_ID` | *(your account ID)* | From Part 2.2 |
| `CLOUDFLARE_ZONE` | *(your domain)* | Your domain |
| `GOOGLE_AI_API_KEY` | *(your API key from Part 1.1)* | From Part 1.1 |
| `WORKER_API_KEY` | *(generate below)* | Generate locally |

#### Generate WORKER_API_KEY

```bash
# Clone the repo if you haven't
git clone YOUR_REPO_URL
cd cuteBirdSlopMachine

# Install dependencies
npm install

# Generate a secure API key
npm run generate-api-key
```

Copy the generated key and add it as `WORKER_API_KEY` secret.

### 3.2 Create GitHub Environment

1. Go to https://github.com/YOUR_USERNAME/YOUR_REPO/settings/environments
2. Click **"New environment"**
3. Name: `production`
4. Click **"Configure environment"**
5. (Optional) Add protection rules:
   - ✅ Required reviewers
   - ✅ Wait timer
6. Click **"Save protection rules"**

---

## Part 4: Deploy Infrastructure

### 4.1 Run Infrastructure Workflow

1. Go to https://github.com/YOUR_USERNAME/YOUR_REPO/actions
2. Click **"Infrastructure Setup"** (left sidebar)
3. Click **"Run workflow"** (right side)
4. Keep defaults → Click **"Run workflow"**
5. Wait for workflow to complete (~2 minutes)

### 4.2 Get Resource IDs from Workflow Output

1. Click the completed workflow run
2. Click **"Setup Cloudflare Infrastructure"** job
3. Expand **"Output Infrastructure IDs"** step
4. Copy the IDs shown:

```
D1 Databases:
│ name              │ database_id                         │
│ bird-prompts-db   │ abc123-def456-ghi789                │

KV Namespaces:
│ title           │ id                              │
│ PROMPTS_KV      │ abc123def456                    │

Queues:
│ queue_name              │ created_on          │
│ video-generation-queue  │ 2025-10-01T...      │
```

**Save these IDs** - you need them next.

### 4.3 Update wrangler.toml Locally

**Option A: Interactive Setup** (Recommended)
```bash
npm run setup
# Follow the prompts to enter your resource IDs
```

**Option B: Manual Edit**
```bash
cp wrangler.toml.example wrangler.toml
# Edit wrangler.toml and replace:
# - YOUR_KV_NAMESPACE_ID → (KV id from step 4.2)
# - YOUR_KV_PREVIEW_ID → (same KV id, or create a preview one)
# - YOUR_D1_DATABASE_ID → (D1 database_id from step 4.2)
```

**⚠️ Important:** `wrangler.toml` is gitignored. This is local configuration only.

---

## Part 5: Deploy Application

### 5.1 Trigger Deployment

**Option A: Push to Master** (Auto-deploys)
```bash
git push origin master
```

**Option B: Manual Trigger**
1. Go to https://github.com/YOUR_USERNAME/YOUR_REPO/actions
2. Click **"Deploy to Production"**
3. Click **"Run workflow"** → **"Run workflow"**

### 5.2 Monitor Deployment

1. Watch the workflow run (takes ~3-5 minutes)
2. Check for ✅ green checkmarks:
   - Test
   - Deploy
   - Health check

### 5.3 Verify Deployment

Visit your gallery:
```
https://cute-bird-slop-machine.YOUR_DOMAIN
```

Test health endpoint:
```bash
curl https://cute-bird-slop-machine.YOUR_DOMAIN/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-01T...",
  "environment": "production"
}
```

---

## Part 6: Generate First Content

### 6.1 Generate Prompts

```bash
curl -X POST https://cute-bird-slop-machine.YOUR_DOMAIN/generate-prompts \
  -H "X-API-Key: YOUR_WORKER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

This generates 10 rated bird prompts. Check the gallery to see them.

### 6.2 Generate First Video

Click **"🎬 Generate Video"** button in the gallery on any prompt, or:

```bash
curl -X POST https://cute-bird-slop-machine.YOUR_DOMAIN/generate-video \
  -H "X-API-Key: YOUR_WORKER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Cute Common Eider ducklings swimming in the Baltic Sea",
    "style": "realistic",
    "duration": 15
  }'
```

Video generation takes 11 seconds to 6 minutes. Refresh the gallery to see progress.

---

## Part 7: Configure Cloudflare Worker Routes (Optional)

If you want a custom domain instead of `.workers.dev`:

### 7.1 Add Worker Route

1. Go to https://dash.cloudflare.com/
2. Select your domain
3. Click **Workers Routes** (left sidebar)
4. Click **"Add route"**
5. Enter:
   - Route: `cute-bird-slop-machine.YOUR_DOMAIN/*`
   - Worker: `cute-bird-slop-machine`
6. Click **"Save"**

### 7.2 Add DNS Record (if needed)

1. Go to **DNS** tab
2. Click **"Add record"**
3. Enter:
   - Type: `AAAA`
   - Name: `cute-bird-slop-machine`
   - IPv6 address: `100::` (placeholder for Cloudflare proxy)
   - Proxy status: ✅ Proxied (orange cloud)
4. Click **"Save"**

---

## Troubleshooting

### Deployment fails at "Create wrangler.toml"
- Ensure `wrangler.toml.example` exists in repository
- GitHub Actions will create it automatically

### "Invalid API token" error
- Verify CLOUDFLARE_API_TOKEN has all required permissions
- Check token hasn't expired
- Recreate token with correct scopes

### Health check fails
- Wait 10-15 seconds for cold start
- Check Cloudflare Dashboard → Workers & Pages → Logs
- Verify all GitHub secrets are set correctly

### Database not found
- Run Infrastructure Setup workflow first
- Verify D1 database was created in Cloudflare dashboard

### Video generation returns 404
- Check Google Cloud project has billing enabled
- Verify Vertex AI API is enabled
- Check API key has correct restrictions

### Worker API key rejected
- Ensure you're using the same key you added to GitHub Secrets
- Generate a new key if unsure: `npm run generate-api-key`

---

## Cost Estimate

**Infrastructure:** Free (Cloudflare Free Plan sufficient)

**API Costs:**
- Gemini 2.5 Pro: Free tier covers testing
- Veo 3.0: $0.75/second of video
  - 15-second video = $11.25
  - 30-second video = $22.50

**Monthly estimate** (generating 1 video/day at 15 seconds):
- ~$340/month
- Or ~$11/video on-demand

**Free tier testing:**
- Generate prompts (unlimited, free)
- View gallery (unlimited, free)
- Generate videos (pay-per-use)

---

## Next Steps

1. ✅ Verify gallery loads at your domain
2. ✅ Generate test prompts
3. ✅ Generate 1-2 test videos
4. ✅ Check Cloudflare dashboard for logs
5. ✅ Monitor Google Cloud billing
6. 🎬 Start creating cute bird content!

---

## Support

- GitHub Issues: https://github.com/YOUR_USERNAME/YOUR_REPO/issues
- Cloudflare Docs: https://developers.cloudflare.com/workers/
- Google AI Docs: https://ai.google.dev/

---

## Security Checklist

- ✅ API keys stored only in GitHub Secrets
- ✅ Google API key has restrictions enabled
- ✅ Worker API key is unique and secure
- ✅ Production environment protection enabled
- ✅ `.env` file is gitignored
- ✅ No secrets in git history

**Remember:** Never commit API keys to git!
