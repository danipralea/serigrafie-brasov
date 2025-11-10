#!/bin/bash

# Start Firebase Emulators and Dev Server for E2E Testing
# This script should be run in a dedicated terminal

set -e

echo "🚀 Starting E2E Test Environment..."
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed"
    echo "Run: npm install -g firebase-tools"
    exit 1
fi

# Check if Java is installed (required for Firestore emulator)
if ! command -v java &> /dev/null; then
    echo "❌ Java is not installed (required for Firestore emulator)"
    echo "macOS: brew install openjdk@11"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Start Firebase emulators
echo "🔥 Starting Firebase Emulators..."
echo "   - Firestore: http://localhost:8080"
echo "   - Auth: http://localhost:9099"
echo "   - Storage: http://localhost:9199"
echo "   - Emulator UI: http://localhost:4000"
echo ""
echo "⚠️  Keep this terminal open while running tests"
echo "Press Ctrl+C to stop emulators"
echo ""

firebase emulators:start
