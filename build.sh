#!/bin/bash
set -e  # Exit on any error

echo "==> Installing dependencies..."
npm install

echo "==> Building shared package..."
cd packages/shared
npm run build
cd ../..
echo "✓ Shared package built"
ls -la packages/shared/dist

echo "==> Building server package..."
cd packages/server
npm run build
cd ../..
echo "✓ Server package built"
ls -la packages/server/dist

echo "==> Verifying dist/index.js exists..."
if [ -f "packages/server/dist/index.js" ]; then
    echo "✓ dist/index.js exists and ready to run"
else
    echo "✗ ERROR: dist/index.js NOT FOUND"
    exit 1
fi
