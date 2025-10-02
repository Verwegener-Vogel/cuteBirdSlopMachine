#!/bin/bash

# Cloudflare API Token Creation Script
# This script uses the Cloudflare API to programmatically create a token
# with the exact permissions needed for Cute Bird Slop Machine.

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 Cloudflare API Token Creation Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This script creates a Cloudflare API token programmatically using"
echo "the Cloudflare API with the exact permissions needed."
echo ""
echo "⚠️  BOOTSTRAP REQUIREMENT:"
echo "    You need an EXISTING credential to create new tokens."
echo ""
echo "    Option 1: API Token with these permissions:"
echo "      • User - API Tokens - Edit"
echo "      • Account - Account Settings - Read"
echo ""
echo "    Option 2: Global API Key (legacy, less secure)"
echo "      • Found at: https://dash.cloudflare.com/profile/api-tokens"
echo "      • Click 'View' under 'Global API Key'"
echo ""
echo "    How to create bootstrap token (Option 1):"
echo "      1. Go to: https://dash.cloudflare.com/profile/api-tokens"
echo "      2. Click 'Create Token'"
echo "      3. Click 'Use template' on 'Create Additional Tokens'"
echo "      4. Set permissions:"
echo "         - User - API Tokens - Edit"
echo "         - Account - Account Settings - Read"
echo "      5. Click 'Continue to summary' → 'Create Token'"
echo "      6. Copy the token and use it here"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check for required tools
if ! command -v curl &> /dev/null; then
    echo "❌ Error: curl is required but not installed."
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is required but not installed."
    echo "   Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

# Get bootstrap credentials
echo "📋 STEP 1: Provide Bootstrap Credentials"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Choose authentication method:"
echo "  1) API Token (recommended - more secure)"
echo "  2) Global API Key + Email (legacy)"
echo ""
read -p "Enter choice (1 or 2): " auth_choice

if [ "$auth_choice" = "1" ]; then
    echo ""
    read -sp "Enter your existing Cloudflare API Token: " BOOTSTRAP_TOKEN
    echo ""
    AUTH_HEADER="Authorization: Bearer $BOOTSTRAP_TOKEN"
elif [ "$auth_choice" = "2" ]; then
    echo ""
    read -p "Enter your Cloudflare account email: " CF_EMAIL
    read -sp "Enter your Global API Key: " CF_GLOBAL_KEY
    echo ""
    AUTH_HEADER="X-Auth-Email: $CF_EMAIL"
    AUTH_KEY_HEADER="X-Auth-Key: $CF_GLOBAL_KEY"
else
    echo "❌ Invalid choice"
    exit 1
fi

# Get account ID
echo ""
echo "📋 STEP 2: Get Account Information"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$auth_choice" = "1" ]; then
    ACCOUNTS_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/v4/accounts" \
        -H "$AUTH_HEADER" \
        -H "Content-Type: application/json")
else
    ACCOUNTS_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/v4/accounts" \
        -H "$AUTH_HEADER" \
        -H "$AUTH_KEY_HEADER" \
        -H "Content-Type: application/json")
fi

# Check if request was successful
if ! echo "$ACCOUNTS_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo "❌ Error: Failed to authenticate with Cloudflare API"
    echo ""
    echo "Response:"
    echo "$ACCOUNTS_RESPONSE" | jq '.'
    exit 1
fi

# Parse accounts
ACCOUNT_COUNT=$(echo "$ACCOUNTS_RESPONSE" | jq '.result | length')

if [ "$ACCOUNT_COUNT" -eq 0 ]; then
    echo "❌ Error: No accounts found"
    exit 1
elif [ "$ACCOUNT_COUNT" -eq 1 ]; then
    ACCOUNT_ID=$(echo "$ACCOUNTS_RESPONSE" | jq -r '.result[0].id')
    ACCOUNT_NAME=$(echo "$ACCOUNTS_RESPONSE" | jq -r '.result[0].name')
    echo "✓ Using account: $ACCOUNT_NAME ($ACCOUNT_ID)"
else
    echo "Multiple accounts found:"
    echo "$ACCOUNTS_RESPONSE" | jq -r '.result[] | "\(.id) - \(.name)"'
    echo ""
    read -p "Enter Account ID to use: " ACCOUNT_ID
fi

# Create token payload
echo ""
echo "📋 STEP 3: Create API Token"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOKEN_NAME="cute-bird-slop-machine-$(date +%Y%m%d-%H%M%S)"

# Build the token creation payload
TOKEN_PAYLOAD=$(cat <<EOF
{
  "name": "$TOKEN_NAME",
  "policies": [
    {
      "effect": "allow",
      "resources": {
        "com.cloudflare.api.account.$ACCOUNT_ID": "*"
      },
      "permission_groups": [
        {
          "id": "c8fed203ed3043cba015a93ad1616f1f",
          "name": "Workers Scripts Write"
        },
        {
          "id": "b955d8c7b8c245fc964fa5d0e3e8e3f5",
          "name": "D1 Write"
        },
        {
          "id": "e086da7e2179491d91ee5f35b3ca210a",
          "name": "Workers KV Storage Write"
        },
        {
          "id": "ed07f6c337da4195b4e72a1fb2c6bcae",
          "name": "Workers Queues Write"
        },
        {
          "id": "e6d2666161e84845a636613608cee8d5",
          "name": "Account Settings Read"
        }
      ]
    },
    {
      "effect": "allow",
      "resources": {
        "com.cloudflare.api.account.zone.*": "*"
      },
      "permission_groups": [
        {
          "id": "c8fed203ed3043cba015a93ad1616f1f",
          "name": "Workers Routes Write"
        }
      ]
    }
  ]
}
EOF
)

echo "Creating token: $TOKEN_NAME"
echo ""

# Create the token
if [ "$auth_choice" = "1" ]; then
    CREATE_RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/v4/user/tokens" \
        -H "$AUTH_HEADER" \
        -H "Content-Type: application/json" \
        -d "$TOKEN_PAYLOAD")
else
    CREATE_RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/v4/user/tokens" \
        -H "$AUTH_HEADER" \
        -H "$AUTH_KEY_HEADER" \
        -H "Content-Type: application/json" \
        -d "$TOKEN_PAYLOAD")
fi

# Check if token creation was successful
if ! echo "$CREATE_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo "❌ Error: Failed to create token"
    echo ""
    echo "Response:"
    echo "$CREATE_RESPONSE" | jq '.'
    exit 1
fi

# Extract the token value
NEW_TOKEN=$(echo "$CREATE_RESPONSE" | jq -r '.result.value')
TOKEN_ID=$(echo "$CREATE_RESPONSE" | jq -r '.result.id')

echo "✅ Token created successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔑 YOUR NEW API TOKEN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Token ID:   $TOKEN_ID"
echo "Token Name: $TOKEN_NAME"
echo ""
echo "⚠️  COPY THIS TOKEN NOW - IT WILL NOT BE SHOWN AGAIN:"
echo ""
echo "$NEW_TOKEN"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Optionally save to file
read -p "Would you like to save this token to .env file? (y/n): " save_choice

if [[ "$save_choice" =~ ^[Yy]$ ]]; then
    if [ -f ".env" ]; then
        # Update existing .env
        if grep -q "^CLOUDFLARE_API_TOKEN=" .env; then
            # Token exists, update it
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^CLOUDFLARE_API_TOKEN=.*|CLOUDFLARE_API_TOKEN=$NEW_TOKEN|" .env
            else
                sed -i "s|^CLOUDFLARE_API_TOKEN=.*|CLOUDFLARE_API_TOKEN=$NEW_TOKEN|" .env
            fi
            echo "✓ Updated CLOUDFLARE_API_TOKEN in .env"
        else
            # Token doesn't exist, append it
            echo "CLOUDFLARE_API_TOKEN=$NEW_TOKEN" >> .env
            echo "✓ Added CLOUDFLARE_API_TOKEN to .env"
        fi

        # Update account ID if not present
        if ! grep -q "^CLOUDFLARE_ACCOUNT_ID=" .env; then
            echo "CLOUDFLARE_ACCOUNT_ID=$ACCOUNT_ID" >> .env
            echo "✓ Added CLOUDFLARE_ACCOUNT_ID to .env"
        fi
    else
        # Create new .env from example
        if [ -f ".env.example" ]; then
            cp .env.example .env
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|your_cloudflare_api_token|$NEW_TOKEN|" .env
                sed -i '' "s|your_cloudflare_account_id|$ACCOUNT_ID|" .env
            else
                sed -i "s|your_cloudflare_api_token|$NEW_TOKEN|" .env
                sed -i "s|your_cloudflare_account_id|$ACCOUNT_ID|" .env
            fi
            echo "✓ Created .env file with token"
        else
            echo "CLOUDFLARE_API_TOKEN=$NEW_TOKEN" > .env
            echo "CLOUDFLARE_ACCOUNT_ID=$ACCOUNT_ID" >> .env
            echo "✓ Created new .env file"
        fi
    fi
    echo ""
    echo "⚠️  Remember: .env is gitignored - it will NOT be committed to git"
fi

echo ""
echo "📋 Next Steps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Add to GitHub Secrets:"
echo "   Go to: https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions"
echo "   Name:  CLOUDFLARE_API_TOKEN"
echo "   Value: (paste the token above)"
echo ""
echo "2. Also add these GitHub Secrets:"
echo "   CLOUDFLARE_ACCOUNT_ID: $ACCOUNT_ID"
echo "   CLOUDFLARE_ZONE: (your domain, e.g., vogel.yoga)"
echo "   GOOGLE_AI_API_KEY: (from Google AI Studio)"
echo "   WORKER_API_KEY: (run: npm run generate-api-key)"
echo ""
echo "3. Continue with infrastructure setup (see SETUP.md)"
echo ""
echo "⚠️  SECURITY REMINDERS:"
echo "   • NEVER commit this token to git"
echo "   • NEVER share it in chat/email/screenshots"
echo "   • Store ONLY in GitHub Secrets and local .env"
echo "   • Rotate if ever exposed"
echo ""
