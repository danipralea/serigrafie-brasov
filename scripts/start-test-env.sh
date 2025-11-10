#!/bin/bash

# Start Firebase Emulators with Test Security Rules
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

# Backup production rules and use test rules
echo "📋 Configuring test security rules..."
if [ -f "firestore.rules.backup" ]; then
    echo "   ⚠️  Backup already exists"
else
    cp firestore.rules firestore.rules.backup
    echo "   ✅ Backed up production rules"
fi

cp firestore.test.rules firestore.rules
echo "   ✅ Using test rules (firestore.test.rules)"
echo ""

# Function to restore rules on exit
cleanup() {
    echo ""
    echo "🔄 Restoring production rules..."
    if [ -f "firestore.rules.backup" ]; then
        mv firestore.rules.backup firestore.rules
        echo "   ✅ Restored production rules"
    fi
    exit 0
}

# Set trap to restore rules on exit
trap cleanup EXIT INT TERM

# Start Firebase emulators
echo "🔥 Starting Firebase Emulators with TEST RULES..."
echo "   - Firestore: http://localhost:8080"
echo "   - Auth: http://localhost:9099"
echo "   - Storage: http://localhost:9199"
echo "   - Emulator UI: http://localhost:4000"
echo ""
echo "⚠️  Keep this terminal open while running tests"
echo "⚠️  Production rules will be restored when you press Ctrl+C"
echo ""

firebase emulators:start
