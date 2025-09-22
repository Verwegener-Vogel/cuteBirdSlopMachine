# Cute Bird Slop Machine - Storage Strategy

## Current Implementation ✅

Your implementation is already optimal! Here's what it does:

- **R2 Object Storage**: Videos stored as objects (NOT in a database)
- **D1 Database**: Only stores metadata and R2 keys/paths
- **Video Path**: `videos/{videoId}/{timestamp}.mp4`

## What is R2?

**R2 is NOT a relational database!** It's Cloudflare's object storage service, similar to AWS S3, designed specifically for large files like videos.

## Cost Comparison

### For 1000 videos (~100GB):

| Service | Storage Cost | Egress Cost | Total Monthly |
|---------|-------------|-------------|---------------|
| **R2 (Current)** | $1.50 | $0 | **$1.50** |
| Cloudflare Stream | ~$250 | Included | $250+ |
| AWS S3 | $2.30 | $9/TB | $11.30+ |

**R2 wins by a massive margin!**

## Key Advantages of R2

1. **ZERO egress fees** - Huge advantage with Enterprise Workers
2. **10M free Class A operations/month**
3. **Direct Workers integration**
4. **Lowest storage cost**
5. **No bandwidth limits**

## Optimization Applied

### Memory Fix
Changed from buffering entire video in memory to streaming directly:
```typescript
// Before: await response.arrayBuffer() - could crash with 128MB limit
// After: response.body - streams directly, handles any size
```

### Storage Policy
**Videos are stored indefinitely** - No automatic deletion.

To monitor storage usage:
```bash
wrangler r2 bucket info VIDEO_STORAGE
```

## When to Consider Alternatives

### Cloudflare Stream
Only if you need:
- Automatic transcoding (multiple resolutions)
- Adaptive bitrate streaming
- Built-in video player
- Advanced analytics

For your use case (storing generated bird videos), R2 is perfect.

## Monitoring Costs

Track your R2 usage:
```bash
wrangler r2 bucket info VIDEO_STORAGE
```

## New Features Added

### 1. Secure Download Links
- JWT tokens with 15-minute expiry
- Endpoint: `/api/videos/{id}/download?token={jwt}`
- Tokens automatically generated in `/videos` response

### 2. HTML Video Gallery
- Endpoint: `/videos.html`
- Self-contained HTML with embedded video players
- Features:
  - Responsive grid layout
  - Lazy loading for performance
  - Inline video playback
  - Download buttons
  - Cuteness scores
  - Beautiful gradient design

### 3. Security Features
- Short-lived JWT tokens (15 minutes)
- Token validation on download
- CORS headers for browser access
- Secure streaming from R2

## API Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/videos` | GET | JSON list with download tokens | No |
| `/videos.html` | GET | HTML video gallery | No |
| `/api/videos/{id}/stream` | GET | Stream video from R2 | Bearer token |
| `/api/videos/{id}/download` | GET | Download video with JWT | Token in URL |

## Summary

Your architecture is optimal:
- R2 for video storage (indefinite retention)
- JWT for secure, time-limited access
- HTML gallery for easy viewing
- Streaming uploads to handle large files