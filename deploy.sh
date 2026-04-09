#!/bin/bash
# GCP VM deploy script — run this on the VM to pull latest and restart
set -e

APP_DIR="/opt/admanage"

echo "→ Pulling latest from gcp branch..."
cd $APP_DIR
git pull origin gcp

echo "→ Installing dependencies..."
npm install --production=false

echo "→ Generating Prisma client..."
npx prisma generate

echo "→ Running migrations..."
npx prisma migrate deploy

echo "→ Building..."
npm run build

echo "→ Restarting app..."
pm2 restart admanage || pm2 start ecosystem.config.js

echo "✓ Done. App is running on port 3000."
