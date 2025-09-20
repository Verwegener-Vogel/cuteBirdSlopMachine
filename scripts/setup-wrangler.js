#!/usr/bin/env node

/**
 * Setup wrangler.toml with actual Cloudflare resource IDs
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

async function setupWrangler() {
  console.log('🔧 Cloudflare Workers Configuration Setup');
  console.log('━'.repeat(50));
  console.log('This script will help you configure wrangler.toml with your Cloudflare resource IDs.\n');
  console.log('Run the infrastructure GitHub Action first to create these resources,');
  console.log('then copy the IDs from the workflow output.\n');
  console.log('━'.repeat(50));

  // Check if wrangler.toml already exists
  const wranglerPath = path.join(process.cwd(), 'wrangler.toml');
  const templatePath = path.join(process.cwd(), 'wrangler.toml.example');

  if (!fs.existsSync(templatePath)) {
    console.error('❌ Error: wrangler.toml.example not found');
    process.exit(1);
  }

  if (fs.existsSync(wranglerPath)) {
    const overwrite = await question('\n⚠️  wrangler.toml already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Aborted.');
      rl.close();
      return;
    }
  }

  console.log('\nEnter your Cloudflare resource IDs:\n');

  // Collect IDs
  const kvNamespaceId = await question('KV Namespace ID (for PROMPTS_KV): ');
  const kvPreviewId = await question('KV Namespace Preview ID: ');
  const d1DatabaseId = await question('D1 Database ID (for bird-prompts-db): ');

  // Read template
  let template = fs.readFileSync(templatePath, 'utf8');

  // Replace placeholders
  template = template.replace('YOUR_KV_NAMESPACE_ID', kvNamespaceId.trim());
  template = template.replace('YOUR_KV_PREVIEW_ID', kvPreviewId.trim());
  template = template.replace('YOUR_D1_DATABASE_ID', d1DatabaseId.trim());

  // Write configured file
  fs.writeFileSync(wranglerPath, template);

  console.log('\n✅ wrangler.toml has been configured successfully!');
  console.log('\n📝 Next steps:');
  console.log('1. Review the generated wrangler.toml');
  console.log('2. Run `npm run dev` to test locally');
  console.log('3. Run `npm run deploy` to deploy to Cloudflare Workers');

  rl.close();
}

setupWrangler().catch(console.error);