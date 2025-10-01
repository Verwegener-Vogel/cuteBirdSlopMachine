# Videos Endpoint 500 Error - Fix Documentation

## Issue
The `/videos` endpoint was returning HTTP 500 with error: `D1_ERROR: no such column: v.google_url`

## Root Cause
The SQL query in the `/videos` endpoint references columns (`google_url`, `r2_key`, `downloaded_at`) that were added in migration files but not applied to the local D1 database.

## Solution

### Immediate Fix
Applied the missing columns directly to the local database:
```bash
npx wrangler d1 execute bird-prompts-db --local --command "ALTER TABLE videos ADD COLUMN google_url TEXT"
npx wrangler d1 execute bird-prompts-db --local --command "ALTER TABLE videos ADD COLUMN r2_key TEXT"
npx wrangler d1 execute bird-prompts-db --local --command "ALTER TABLE videos ADD COLUMN downloaded_at INTEGER"
```

### Long-term Prevention

1. **Setup Script**: Created `scripts/setup-local-db.js` to check and add missing columns
   ```bash
   npm run setup:db
   ```

2. **Unit Tests**: Added comprehensive tests in `test/videos-endpoint.test.js`
   ```bash
   npm run test:videos
   ```

3. **Migration Handling**: Updated migration files to be idempotent

## Testing
- Endpoint now returns 200 OK with properly formatted video data
- Tests verify schema compatibility and data formatting
- Setup script ensures database is in correct state

## Usage for Developers
After pulling the latest code:
1. Run `npm run setup:db` to ensure database schema is up to date
2. Run `npm run dev` to start the development server
3. Run `npm run test:videos` to verify the endpoint works correctly