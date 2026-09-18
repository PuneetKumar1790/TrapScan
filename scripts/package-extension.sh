#!/bin/bash

# TrapScan Extension Packer
# Bundles the dist/ folder into a distributable ZIP file

set -e

VERSION=$(grep '"version"' manifest.json | head -1 | sed 's/.*"version": "\\([^"]*\\)".*/\\1/')
OUTPUT="trapscan-v${VERSION}.zip"

echo "📦 Building TrapScan v${VERSION}..."

# Clean and rebuild
npm run build

# Navigate to dist and create ZIP
cd dist
echo "🗜️  Compressing to ${OUTPUT}..."
zip -r "../${OUTPUT}" . -x "*.git*" "node_modules/*" ".env*"
cd ..

echo "✅ Extension packaged: ${OUTPUT}"
echo ""
echo "📋 Next steps:"
echo "1. Upload to Chrome Web Store: https://chrome.google.com/webstore/devconsole"
echo "2. Or share directly: ${OUTPUT}"
echo ""
echo "📊 Package size: $(du -h ${OUTPUT} | cut -f1)"
