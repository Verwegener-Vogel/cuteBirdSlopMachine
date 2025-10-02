#!/bin/bash

# Cloudflare API Token Creation Script
# This script provides instructions for creating the required Cloudflare API token
# IMPORTANT: This script does NOT expose any secrets - it only provides guidance

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 Cloudflare API Token Creation Guide"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This script will guide you through creating a Cloudflare API token"
echo "with the exact permissions needed for Cute Bird Slop Machine."
echo ""
echo "⚠️  SECURITY NOTE: This script does NOT create the token automatically."
echo "    You must create it manually in the Cloudflare dashboard to maintain"
echo "    security best practices."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Open browser
echo "📋 STEP 1: Open Cloudflare API Tokens Page"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Opening: https://dash.cloudflare.com/profile/api-tokens"
echo ""

if command -v open &> /dev/null; then
    open "https://dash.cloudflare.com/profile/api-tokens"
elif command -v xdg-open &> /dev/null; then
    xdg-open "https://dash.cloudflare.com/profile/api-tokens"
else
    echo "Please manually open: https://dash.cloudflare.com/profile/api-tokens"
fi

echo "Press Enter when the page has loaded..."
read

# Step 2: Create token
echo ""
echo "📋 STEP 2: Create New Token"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Click the 'Create Token' button"
echo "2. Click 'Use template' on 'Edit Cloudflare Workers'"
echo ""
echo "Press Enter when you've started creating the token..."
read

# Step 3: Configure permissions
echo ""
echo "📋 STEP 3: Configure Token Permissions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Set these ACCOUNT permissions:"
echo ""
echo "  ✓ Workers Scripts         : Edit"
echo "  ✓ D1                      : Edit"
echo "  ✓ Workers KV Storage      : Edit"
echo "  ✓ Cloudflare Queues       : Edit"
echo "  ✓ Account Settings        : Read"
echo ""
echo "Set these ZONE permissions:"
echo ""
echo "  ✓ Workers Routes          : Edit"
echo ""
echo "Press Enter when permissions are configured..."
read

# Step 4: Set account resources
echo ""
echo "📋 STEP 4: Set Account Resources"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Under 'Account Resources':"
echo "  • Select: Include"
echo "  • Choose: Your specific account"
echo ""
echo "Press Enter when account is selected..."
read

# Step 5: Create and copy
echo ""
echo "📋 STEP 5: Create Token and Copy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Click 'Continue to summary'"
echo "2. Review the permissions"
echo "3. Click 'Create Token'"
echo "4. COPY THE TOKEN IMMEDIATELY (you won't see it again!)"
echo ""
echo "Press Enter after copying the token..."
read

# Step 6: Save to GitHub Secrets
echo ""
echo "📋 STEP 6: Add to GitHub Secrets"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Go to your repository settings:"
echo "  https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions"
echo ""
echo "Add a new secret:"
echo "  Name:  CLOUDFLARE_API_TOKEN"
echo "  Value: (paste the token you just copied)"
echo ""
echo "⚠️  CRITICAL SECURITY REMINDER:"
echo "    • NEVER commit this token to git"
echo "    • NEVER share it in chat/email"
echo "    • NEVER paste it in code comments"
echo "    • Store ONLY in GitHub Secrets"
echo ""

# Optional: Open GitHub secrets page
echo "Would you like to open the GitHub Secrets page? (y/n)"
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    echo ""
    echo "Please enter your GitHub repository URL:"
    echo "(e.g., https://github.com/username/repo)"
    read -r repo_url

    # Extract owner and repo from URL
    if [[ "$repo_url" =~ github\.com[/:]([^/]+)/([^/\.]+) ]]; then
        owner="${BASH_REMATCH[1]}"
        repo="${BASH_REMATCH[2]}"
        secrets_url="https://github.com/${owner}/${repo}/settings/secrets/actions"

        echo "Opening: $secrets_url"

        if command -v open &> /dev/null; then
            open "$secrets_url"
        elif command -v xdg-open &> /dev/null; then
            xdg-open "$secrets_url"
        else
            echo "Please manually open: $secrets_url"
        fi
    else
        echo "Invalid GitHub URL format. Please manually navigate to:"
        echo "  Settings → Secrets and variables → Actions → New repository secret"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Token Creation Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Verify CLOUDFLARE_API_TOKEN is added to GitHub Secrets"
echo "  2. Also add CLOUDFLARE_ACCOUNT_ID (from Cloudflare dashboard)"
echo "  3. Add CLOUDFLARE_ZONE (your domain name)"
echo "  4. Continue with infrastructure setup"
echo ""
echo "See SETUP.md for complete deployment instructions."
echo ""
