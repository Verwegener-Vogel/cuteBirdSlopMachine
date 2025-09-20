# Cute Bird Slop Machine - AI Assistant Guidelines

## Project Mission

Create an automated system that generates the maximum volume of adorable bird AI video content, specifically featuring Northern German Baltic coastal bird species, using Google's Gemini AI capabilities.

## Core Objectives

1. **Maximize Cute Bird Content Production**: Generate as many unique, high-quality bird videos as possible
2. **Regional Focus**: Concentrate on bird species native to the Baltic Sea coastline of Northern Germany
3. **Style Diversity**: Balance between realistic nature documentary style and whimsical cartoon aesthetics
4. **Prompt Intelligence**: Build a self-improving prompt generation system that learns from successful outputs

## Technical Guidelines

### Platform Requirements
- **Primary Infrastructure**: Cloudflare Workers (user has Enterprise plan - utilize all available features)
- **AI Provider**: Google Gemini API (2.5 Pro for prompt generation, Video API for content)
- **Storage**: Use Cloudflare KV or D1 for prompt persistence
- **Queue System**: Cloudflare Queues for video generation pipeline

### Implementation Standards
- Keep the codebase minimal and focused
- Prioritize performance and scalability on edge infrastructure
- Use TypeScript for type safety
- Implement proper error handling and retry logic
- Store all prompts to build training dataset

### API Integration Details

#### Gemini 2.5 Pro Usage
- Generate batches of 10 prompt ideas per request
- Each prompt should be rated 1-10 for:
  - Cuteness potential
  - Alignment with Baltic bird theme
  - Visual appeal likelihood
  - Uniqueness score

#### Video Generation
- Use Google AI Video API with dialogue/scene capabilities
- Target output: 10-30 second clips
- Mix realistic and stylized rendering
- Include ambient bird sounds when possible

## Content Guidelines

### Featured Bird Species
Focus on Baltic coastal species including but not limited to:
- Common Eider (Somateria mollissima)
- Great Cormorant (Phalacrocorax carbo)
- Mute Swan (Cygnus olor)
- Common Tern (Sterna hirundo)
- Eurasian Oystercatcher (Haematopus ostralegus)
- Common Gull (Larus canus)
- Red-breasted Merganser (Mergus serrator)
- Barnacle Goose (Branta leucopsis)
- White-tailed Eagle (Haliaeetus albicilla)

### Prompt Engineering Principles
1. **Cuteness Factors**: Baby birds, fluffy feathers, playful behavior, group activities
2. **Settings**: Baltic beaches, coastal marshes, cliff colonies, harbor scenes
3. **Activities**: Feeding, preening, swimming, flying formations, nesting
4. **Seasonal Variations**: Migration scenes, winter plumage, breeding displays
5. **Style Mixing**: "Pixar-style puffin on German beach" or "Documentary footage of cute eider ducklings"

## Data Management

### Prompt Storage Schema
```typescript
interface BirdPrompt {
  id: string;
  prompt: string;
  createdAt: number;
  cutenessScore: number;
  alignmentScore: number;
  usageCount: number;
  generatedVideos: string[];
  tags: string[];
}
```

### Deduplication Strategy
- Hash prompts before storage
- Check similarity threshold (>85% = duplicate)
- Track variations for A/B testing

## Development Workflow

### For New Features
1. Check if it maximizes cute bird content generation
2. Ensure it works with Cloudflare Workers constraints
3. Test with actual Baltic bird species
4. Measure cuteness improvement metrics

### Code Style
- Functional programming where appropriate
- Async/await over callbacks
- Clear naming: `generateCuteBirdPrompt()` not `genPrompt()`
- Comments only for complex bird-specific logic

### Testing Priorities
1. Prompt uniqueness validation
2. API rate limit handling
3. Cuteness scoring accuracy
4. Baltic species representation

## Performance Targets

- Generate 100+ unique prompts per day
- Process video generation queue within 5 minutes
- Maintain 99% prompt uniqueness rate
- Achieve average cuteness score >7/10

## Security & API Keys

- Store Google AI API keys in Cloudflare environment variables
- Never commit keys to repository
- Implement rate limiting per IP
- Use Cloudflare Access for admin endpoints

## Monitoring & Metrics

Track:
- Daily video generation count
- Average cuteness scores
- Most successful prompt patterns
- API usage and costs
- Species diversity distribution

## Future Expansion Ideas

- User voting system for cuteness
- Seasonal migration tracking features
- Bird sound generation
- AR placement capabilities
- Social media auto-posting

## Remember

The goal is simple: Create an endless stream of adorable bird content featuring our Baltic coastal friends. Every decision should optimize for maximum cuteness and volume. When in doubt, choose the option that generates more cute bird videos.

## CI/CD & Deployment System

### GitHub Actions Architecture

The project uses a three-tier GitHub Actions strategy optimized for Cloudflare Workers:

#### Infrastructure Workflow (`infrastructure.yml`)
- **When to Use**: Initial setup or when adding new Cloudflare resources
- **What it Does**: Creates D1 databases, KV namespaces, and message queues
- **Important**: Run this BEFORE first deployment to create required resources
- **Manual Trigger**: Can be run via Actions tab → Infrastructure Setup → Run workflow

#### Deployment Workflow (`deploy.yml`)
- **Production Deployment**: Automatic on push to master
- **Preview Deployments**: Automatic for all pull requests
- **Branch Strategy**:
  - Master → Production environment
  - PR → Isolated preview environment (auto-cleanup on merge/close)
- **Validation**: TypeScript checks and dry-run before actual deployment

#### Scheduled Generation (`scheduled.yml`)
- **Frequency**: Every 6 hours (cron: `0 */6 * * *`)
- **Purpose**: Maintains fresh prompt pipeline
- **Manual Override**: Can trigger with custom batch count
- **Rate Limiting**: 2-second delay between batches

### Environment Management

#### Production
- URL: `https://cute-bird-slop-machine.YOUR_DOMAIN.workers.dev`
- Auto-deploys from master branch
- Uses production D1 database and KV namespace
- Full Cloudflare Enterprise features enabled

#### Preview/Branch Deployments
- URL: `https://cute-bird-slop-machine-pr-{number}.YOUR_DOMAIN.workers.dev`
- Isolated environment per pull request
- Shares infrastructure resources (different namespace prefixes)
- Automatic cleanup on PR close
- Comments deployment URL on PR for easy testing

### Secret Management

Required GitHub Secrets (set in repo settings):
```
CLOUDFLARE_API_TOKEN     # Scoped token with Workers, D1, KV, Queue permissions
CLOUDFLARE_ACCOUNT_ID    # Found in Cloudflare dashboard
CLOUDFLARE_ZONE         # Your domain for worker routes
GOOGLE_AI_API_KEY       # For Gemini API access
WORKER_API_KEY          # Custom key for scheduled job auth
```

### Infrastructure Resource IDs

After running infrastructure workflow, update `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "PROMPTS_KV"
id = "YOUR_ACTUAL_KV_ID"        # Get from workflow output
preview_id = "YOUR_PREVIEW_ID"   # Get from workflow output

[[d1_databases]]
binding = "DB"
database_name = "bird-prompts-db"
database_id = "YOUR_D1_ID"       # Get from workflow output
```

### Testing Strategy

#### Local Testing
```bash
npm run dev                      # Start local server
# Open bruno-collection in Bruno
# Use 'local' environment
```

#### Preview Testing
- Create PR → Automatic preview deployment
- Test URL posted as PR comment
- Full isolation from production

#### Production Validation
- Health check runs post-deployment
- Scheduled jobs monitor prompt generation
- Use Bruno collection with 'production' environment

### Deployment Checklist

For new deployments:
1. ✅ Set all GitHub secrets
2. ✅ Run infrastructure workflow
3. ✅ Update wrangler.toml with resource IDs
4. ✅ Commit and push to master
5. ✅ Verify deployment via health endpoint
6. ✅ Test with Bruno collection

For updates:
1. ✅ Create feature branch
2. ✅ Push changes (triggers preview)
3. ✅ Test preview URL from PR comment
4. ✅ Merge to master (auto-deploys to production)

### Common Issues & Solutions

**Issue**: Infrastructure workflow fails
**Solution**: Check Cloudflare API token permissions, ensure Enterprise plan active

**Issue**: Preview deployment not accessible
**Solution**: Check PR comment for correct URL, allow 30s for cold start

**Issue**: Scheduled prompts not generating
**Solution**: Verify WORKER_API_KEY secret is set and matches worker expectation

## Quick Commands

- `npm run dev` - Local development server
- `npm run deploy` - Manual production deployment
- `npm run generate-prompts` - Test scheduled prompt generation
- `wrangler tail` - Live production logs
- `wrangler d1 execute bird-prompts-db --command "SELECT COUNT(*) FROM prompts" --remote` - Check prompt count