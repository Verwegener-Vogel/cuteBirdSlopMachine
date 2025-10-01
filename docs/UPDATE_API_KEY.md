# Fix the 500 Error on /generate-prompts

## The Issue
The `/generate-prompts` endpoint returns a 500 error because it's using a demo API key that Google doesn't recognize.

## Solution: Get a Real Google AI API Key

### Step 1: Get Your Free API Key
1. Visit: https://aistudio.google.com/app/apikey
2. Click "Get API Key"
3. Select or create a Google Cloud project
4. Copy your API key

### Step 2: Update Your Local Config
Replace the demo key in `.dev.vars`:

```bash
# Edit .dev.vars
GOOGLE_AI_API_KEY=YOUR_ACTUAL_API_KEY_HERE
WORKER_API_KEY=5xCNny0vYDM7KTdaTU8C_eEkLYh1RKhEiRTR_GWo6TQ
```

### Step 3: Restart the Server
The server will auto-reload when you save the file.

### Step 4: Test It
```bash
curl -X POST http://localhost:8787/generate-prompts \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 5xCNny0vYDM7KTdaTU8C_eEkLYh1RKhEiRTR_GWo6TQ" \
  -d '{}'
```

## Expected Result
Once you add a valid API key, you'll get:
```json
{
  "success": true,
  "promptsGenerated": 10,
  "savedPromptIds": [...],
  "batch": {
    "ideas": [
      {
        "prompt": "Fluffy baby eider ducklings...",
        "cutenessScore": 9.5,
        "alignmentScore": 10,
        ...
      }
    ]
  }
}
```

## Alternative: Mock the API for Testing

If you just want to test without a real API key, I can add a mock mode that returns fake data in development. Let me know if you'd prefer this approach!