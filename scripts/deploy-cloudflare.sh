#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo 'Deploying FarhanGPT to Cloudflare Workers (not static Pages).'
echo 'Before deployment: configure DATABASE_URL and OPENROUTER_API_KEY using npx wrangler secret put.'
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
