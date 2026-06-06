#!/bin/bash
set -e

echo "==> Building Next.js (standalone mode)..."
npm run build

echo "==> Copying static assets into standalone..."
rm -rf .next/standalone/.next/static .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public 2>/dev/null || true

echo "==> Zipping standalone output..."
rm -f /tmp/flight-log-deploy.zip
cd .next/standalone && zip -r /tmp/flight-log-deploy.zip . -q
cd ../..

echo "==> Deploying to Azure App Service..."
az webapp deploy \
  --name flight-log-next \
  --resource-group flight-log-rg \
  --src-path /tmp/flight-log-deploy.zip \
  --type zip \
  --async false

echo "==> Restarting app..."
az webapp restart --name flight-log-next --resource-group flight-log-rg

echo "==> Done! App available at https://flight-log-next.azurewebsites.net"
