#!/bin/bash
set -e  # Exit on any error

echo "=========================================="
echo "BUILD SCRIPT STARTING"
echo "Current directory: $(pwd)"
echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"
echo "=========================================="

echo ""
echo "==> Installing dependencies..."
npm install
echo "✓ Dependencies installed"

echo ""
echo "==> Building shared package..."
echo "Current directory: $(pwd)"
cd packages/shared
echo "Changed to: $(pwd)"
echo "Running: npm run build"
npm run build
cd ../..
echo "✓ Shared package built"
echo "Shared dist contents:"
ls -la packages/shared/dist

echo ""
echo "==> Building server package..."
echo "Current directory: $(pwd)"
cd packages/server
echo "Changed to: $(pwd)"
echo "Running: npm run build"
npm run build
cd ../..
echo "✓ Server package built"
echo "Server dist contents:"
ls -la packages/server/dist

echo ""
echo "==> Verifying dist/index.js exists..."
echo "Checking file: packages/server/dist/index.js"
if [ -f "packages/server/dist/index.js" ]; then
    echo "✓✓✓ dist/index.js exists and ready to run ✓✓✓"
    echo "File size: $(du -h packages/server/dist/index.js)"
else
    echo "✗✗✗ ERROR: dist/index.js NOT FOUND ✗✗✗"
    echo "Current directory structure:"
    find packages/server -type f -name "*.js" || echo "No .js files found"
    exit 1
fi

echo ""
echo "=========================================="
echo "BUILD SCRIPT COMPLETED SUCCESSFULLY"
echo "=========================================="
