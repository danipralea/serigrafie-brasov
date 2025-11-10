# Quick Start: E2E Testing

## Prerequisites

Ensure you have:
- **Node.js 18+**: `node --version`
- **Java 11+**: `java -version` (required for Firestore emulator)

Install Java on macOS if needed:
```bash
brew install openjdk@11
```

## One-Time Setup

```bash
# 1. Checkout the e2e test branch (or main if merged)
git checkout feature/e2e-tests

# 2. Install all dependencies (includes Firebase SDK, Playwright, etc.)
npm install

# 3. Install Playwright browsers
npx playwright install chromium

# 4. Install Firebase emulators
firebase setup:emulators:firestore
firebase setup:emulators:auth
firebase setup:emulators:storage
```

## Running Tests

```bash
# Run all tests (headless mode)
npm test

# Run with visible browser (great for debugging)
npm run test:headed

# Interactive UI mode (recommended for development)
npm run test:ui

# Debug mode (step through tests)
npm run test:debug
```

## What Happens When You Run Tests?

1. **Firebase emulators start** automatically (Auth, Firestore, Storage)
2. **Vite dev server starts** at `localhost:5173`
3. **Test data is seeded** (users, orders, product types)
4. **Tests run** against the local environment
5. **Data is cleaned** between each test
6. **Emulators stop** when tests complete

## Test Users

The following users are automatically created for each test:

- **Admin**: `admin@test.com` / `testpassword123`
- **Team Member**: `team@test.com` / `testpassword123`
- **Client**: `client@test.com` / `testpassword123`

## View Test Results

```bash
# Open the last test report
npm run test:report
```

## Manual Emulator Control

If you want to run emulators separately:

```bash
# Terminal 1: Start emulators
npm run emulators

# Terminal 2: Run dev server
cd client && npm run dev

# Terminal 3: Run tests
npx playwright test --headed
```

Access Emulator UI at: `http://localhost:4000`

## Next Steps

- ✅ Read the full guide: `E2E_TEST_SETUP.md`
- ✅ Write your first test following examples in `e2e-tests/specs/`
- ✅ Use `npm run test:ui` for interactive development

## Troubleshooting

**"Java not found"**
```bash
brew install openjdk@11
java -version
```

**"Port already in use"**
```bash
# Find and kill process on port 8080 (Firestore)
lsof -i :8080
kill -9 <PID>
```

**Tests timing out**
- Make sure emulators have Java installed
- Check if ports 8080, 9099, 9199, 5173 are available
- Try running emulators manually: `npm run emulators`

**Need more help?**
See the comprehensive guide in `E2E_TEST_SETUP.md`

---

**Ready to test!** 🚀

Run `npm run test:ui` to get started with interactive testing.
