# E2E Testing Setup Guide
## Serigrafie Brasov Order Management System

This document provides a complete guide for setting up and running end-to-end tests for the Serigrafie Brasov application using Firebase Emulators and Playwright.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Running Tests](#running-tests)
6. [Writing Tests](#writing-tests)
7. [Test Architecture](#test-architecture)
8. [Troubleshooting](#troubleshooting)
9. [CI/CD Integration](#cicd-integration)
10. [Best Practices](#best-practices)

---

## Overview

### What is This?

Our e2e testing infrastructure allows you to:
- Test the complete application flow from browser to Firebase backend
- Run tests against Firebase emulators (no production data affected)
- Automatically seed test data for consistent testing
- Debug tests visually with Playwright's UI mode
- Run tests locally or in CI/CD pipelines

### Technology Stack

- **Playwright**: Browser automation and testing framework
- **Firebase Emulators**: Local Firebase services (Auth, Firestore, Storage, Functions)
- **TypeScript**: Type-safe test code
- **Node.js**: Runtime environment

### What Gets Tested?

Current test coverage includes:
- ✅ User authentication (login, logout, error handling)
- ✅ Order creation (client and admin flows)
- ✅ Form validation
- ✅ Dashboard functionality
- ✅ Role-based access (admin, team member, client)

---

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   ```bash
   node --version  # Should be v18+
   ```

2. **Java** (v11 or higher) - Required for Firestore emulator
   ```bash
   java -version   # Should be v11+
   ```

   **Install Java on macOS:**
   ```bash
   brew install openjdk@11
   ```

3. **Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase --version
   ```

4. **Git** (for version control)
   ```bash
   git --version
   ```

### System Requirements

- **Memory**: Minimum 4GB RAM (8GB recommended)
- **Disk Space**: At least 2GB free space
- **OS**: macOS, Linux, or Windows with WSL2

---

## Installation

### Step 1: Clone and Navigate to Project

```bash
cd /path/to/serigrafie-brasov
git checkout feature/e2e-tests  # Or main if merged
```

### Step 2: Install Dependencies

Install root-level dependencies (Playwright):
```bash
npm install
```

Install client dependencies:
```bash
cd client
npm install
cd ..
```

Install function dependencies (optional, for Functions emulator):
```bash
cd functions
npm install
cd ..
```

### Step 3: Install Playwright Browsers

```bash
npx playwright install chromium
```

This downloads the Chromium browser used for testing (~200MB).

### Step 4: Install Firebase Emulators

```bash
# Install all required emulators
firebase setup:emulators:firestore
firebase setup:emulators:auth
firebase setup:emulators:storage
firebase setup:emulators:functions  # Optional
```

This downloads the emulator binaries. Total size: ~100-200MB.

### Step 5: Verify Installation

```bash
# Check Playwright
npx playwright --version

# Check Firebase CLI
firebase --version

# Check emulators are installed
firebase emulators:start --only firestore
# Press Ctrl+C to stop
```

---

## Configuration

### Firebase Configuration

The emulator configuration is in `firebase.json`:

```json
{
  "emulators": {
    "auth": {
      "port": 9099
    },
    "firestore": {
      "port": 8080
    },
    "storage": {
      "port": 9199
    },
    "functions": {
      "port": 5001
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
}
```

**Important Ports:**
- **Firestore**: `localhost:8080`
- **Auth**: `localhost:9099`
- **Storage**: `localhost:9199`
- **Functions**: `localhost:5001`
- **Emulator UI**: `localhost:4000` (visual dashboard)
- **Dev Server**: `localhost:5173` (Vite)

### Playwright Configuration

Configuration is in `playwright.config.ts`:

```typescript
export default defineConfig({
  testDir: './e2e-tests/specs',
  workers: 1,                    // Run tests sequentially
  timeout: 60000,                // 60 second timeout per test
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

### Environment Variables

Optional environment variables (see `e2e-tests/test.env.example`):

```bash
FIRESTORE_EMULATOR_PORT=8080
AUTH_EMULATOR_PORT=9099
STORAGE_EMULATOR_PORT=9199
APP_URL=http://localhost:5173
FIREBASE_PROJECT_ID=serigrafie-brasov
```

---

## Running Tests

### Quick Start

```bash
# From project root
npm test
```

This command:
1. Starts Firebase emulators
2. Starts Vite dev server (if not running)
3. Runs all tests in headless mode
4. Generates HTML report
5. Stops emulators

### Test Commands

#### Basic Execution

```bash
# Run all tests (headless, CI-style)
npm test

# Run with browser visible
npm run test:headed

# Run specific test file
npx playwright test e2e-tests/specs/auth.spec.ts

# Run tests matching a pattern
npx playwright test --grep "login"
```

#### Interactive Modes

```bash
# Playwright UI Mode (recommended for development)
npm run test:ui
```

UI Mode features:
- ✅ Run/debug individual tests
- ✅ Time-travel debugging
- ✅ Watch mode (re-run on file changes)
- ✅ Visual test picker

```bash
# Debug Mode (step through with DevTools)
npm run test:debug
```

#### View Results

```bash
# Open last test report
npm run test:report
```

The HTML report shows:
- Test results (pass/fail)
- Screenshots of failures
- Video recordings
- Execution traces
- Error details

### Manual Emulator Control

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

---

## Writing Tests

### Test Structure

```
e2e-tests/
├── fixtures/
│   └── emulator-fixture.ts      # Test fixtures with auto-cleanup
├── specs/
│   ├── auth.spec.ts             # Authentication tests
│   └── order-creation.spec.ts   # Order creation tests
├── utils/
│   ├── firebase-emulator.ts     # Emulator management
│   └── test-data.ts             # Test data seeding
├── global-setup.ts              # Runs before all tests
└── global-teardown.ts           # Runs after all tests
```

### Creating a New Test File

1. Create file in `e2e-tests/specs/`:

```typescript
// e2e-tests/specs/my-feature.spec.ts
import { test, expect } from '../fixtures/emulator-fixture';

test.describe('My Feature', () => {
  test('should do something', async ({ page, testUsers }) => {
    // Navigate to the app
    await page.goto('/');

    // Use test users
    const { client } = testUsers;

    // Your test code here
    await page.getByRole('button', { name: /login/i }).click();
    await page.getByPlaceholder(/email/i).fill(client.email);
    await page.getByPlaceholder(/password/i).fill(client.password);

    // Assert expectations
    await expect(page).toHaveURL(/.*dashboard.*/);
  });
});
```

2. Run your test:

```bash
npx playwright test my-feature.spec.ts --headed
```

### Available Test Fixtures

#### `page` - Playwright Page Object
Standard Playwright page for browser interaction.

#### `testUsers` - Predefined Test Users

```typescript
testUsers.admin = {
  email: 'admin@test.com',
  password: 'testpassword123',
  displayName: 'Test Admin',
  isAdmin: true
}

testUsers.teamMember = {
  email: 'team@test.com',
  password: 'testpassword123',
  displayName: 'Test Team Member',
  isTeamMember: true
}

testUsers.client = {
  email: 'client@test.com',
  password: 'testpassword123',
  displayName: 'Test Client'
}
```

#### `emulators` - Automatic Fixture
Automatically:
- Ensures emulators are running
- Clears data before each test
- Seeds test data (users, orders, product types)
- Cleans up after test

### Test Data Seeding

Each test automatically gets:

**Users:**
- Admin user with full permissions
- Team member with team permissions
- Client user with basic permissions

**Product Types:**
- Mugs
- T-Shirts
- Hoodies

**Sample Data:**
- 1 test order with sub-orders
- All users have profiles in Firestore

### Common Test Patterns

#### Login Pattern

```typescript
async function loginAs(page, user) {
  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByPlaceholder(/email/i).fill(user.email);
  await page.getByPlaceholder(/password/i).fill(user.password);
  await page.getByRole('button', { name: /sign in/i }).last().click();
  await page.waitForURL(/.*dashboard.*/);
}

test('my test', async ({ page, testUsers }) => {
  await loginAs(page, testUsers.client);
  // Rest of test...
});
```

#### Form Filling Pattern

```typescript
test('fill order form', async ({ page }) => {
  // Fill text input
  await page.getByLabel(/quantity/i).fill('100');

  // Select from dropdown
  await page.getByPlaceholder(/product type/i).click();
  await page.getByText('Mugs').click();

  // Check checkbox
  await page.getByRole('checkbox', { name: /urgent/i }).check();

  // Submit form
  await page.getByRole('button', { name: /submit/i }).click();
});
```

#### Assertion Patterns

```typescript
// URL assertions
await expect(page).toHaveURL('/dashboard');
await expect(page).toHaveURL(/.*dashboard.*/);

// Text visibility
await expect(page.getByText('Order Created')).toBeVisible();

// Element state
await expect(page.getByRole('button', { name: /submit/i })).toBeEnabled();
await expect(page.getByLabel(/email/i)).toHaveValue('test@example.com');

// Count elements
await expect(page.getByRole('row')).toHaveCount(5);
```

---

## Test Architecture

### How It Works

```
┌─────────────────────────────────────────────────┐
│  1. Global Setup (global-setup.ts)             │
│     - Start Firebase emulators                  │
│     - Wait for emulators to be ready            │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  2. Playwright Web Server                       │
│     - Start Vite dev server (localhost:5173)    │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  3. For Each Test:                              │
│     a. Fixture Setup (emulator-fixture.ts)      │
│        - Clear emulator data                    │
│        - Seed test data                         │
│     b. Run Test (auth.spec.ts, etc.)            │
│        - Execute test code                      │
│        - Take screenshots on failure            │
│     c. Fixture Teardown                         │
│        - Clear emulator data                    │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  4. Global Teardown (global-teardown.ts)        │
│     - Stop Firebase emulators                   │
│     - Clean up resources                        │
└─────────────────────────────────────────────────┘
```

### Firebase Emulator Manager

Located in `e2e-tests/utils/firebase-emulator.ts`:

**Key Methods:**
- `start()` - Starts all emulators
- `stop()` - Stops all emulators
- `clearAll()` - Clears Auth and Firestore data
- `isRunning()` - Checks if emulators are running
- `waitForEmulators()` - Waits until emulators are ready

### Test Data Manager

Located in `e2e-tests/utils/test-data.ts`:

**Key Functions:**
- `initializeTestFirebase()` - Connect to emulators
- `createTestUser(userData)` - Create user in Auth + Firestore
- `seedTestData()` - Populate emulators with test data

---

## Troubleshooting

### Common Issues

#### 1. "Java not found" Error

**Problem:**
```
Error: Firestore Emulator has exited because java is not installed
```

**Solution:**
```bash
# macOS
brew install openjdk@11

# Verify
java -version
```

#### 2. Port Already in Use

**Problem:**
```
Error: Port 8080 is already in use
```

**Solution:**
```bash
# Find process using the port
lsof -i :8080

# Kill the process
kill -9 <PID>

# Or change port in firebase.json
```

#### 3. Emulators Not Starting

**Problem:**
Tests timeout waiting for emulators.

**Solution:**
```bash
# Manually start to see error messages
firebase emulators:start

# Check if ports are available
lsof -i :8080
lsof -i :9099
lsof -i :9199

# Reinstall emulators
firebase setup:emulators:firestore --force
```

#### 4. Tests Timing Out

**Problem:**
```
Test timeout of 60000ms exceeded
```

**Solution:**
```typescript
// Increase timeout in playwright.config.ts
export default defineConfig({
  timeout: 90000, // 90 seconds
});

// Or per-test
test('slow test', async ({ page }) => {
  test.setTimeout(120000); // 2 minutes
  // test code...
});
```

#### 5. Firebase Connection Errors

**Problem:**
```
FirebaseError: Missing or insufficient permissions
```

**Solution:**
```bash
# Check firestore.rules
# Make sure emulators are using correct rules

# Verify rules in Emulator UI
open http://localhost:4000
```

#### 6. Chromium Not Found

**Problem:**
```
Error: browserType.launch: Executable doesn't exist
```

**Solution:**
```bash
npx playwright install chromium
```

### Debug Checklist

When tests fail:

1. **Run in headed mode**: See what's happening
   ```bash
   npm run test:headed
   ```

2. **Check Emulator UI**: View data at `http://localhost:4000`

3. **Enable trace**: Add to test
   ```typescript
   test.use({ trace: 'on' });
   ```

4. **Check screenshots**: In `test-results/` folder

5. **View HTML report**:
   ```bash
   npm run test:report
   ```

6. **Debug mode**: Step through test
   ```bash
   npm run test:debug
   ```

### Logs and Reports

Test artifacts are saved in:
```
test-results/       # Screenshots, videos, traces
playwright-report/  # HTML report
```

View traces:
```bash
npx playwright show-trace test-results/path/to/trace.zip
```

---

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/e2e-tests.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [main, feature/*]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install Java
        uses: actions/setup-java@v3
        with:
          distribution: 'temurin'
          java-version: '11'

      - name: Install dependencies
        run: |
          npm ci
          cd client && npm ci && cd ..
          cd functions && npm ci && cd ..

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Install Firebase Emulators
        run: |
          npm install -g firebase-tools
          firebase setup:emulators:firestore
          firebase setup:emulators:auth
          firebase setup:emulators:storage

      - name: Run E2E Tests
        run: npm test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

### GitLab CI Example

```yaml
e2e-tests:
  image: mcr.microsoft.com/playwright:v1.40.0-focal
  stage: test
  before_script:
    - apt-get update && apt-get install -y openjdk-11-jdk
    - npm ci
    - cd client && npm ci && cd ..
    - npm install -g firebase-tools
    - firebase setup:emulators:firestore
    - firebase setup:emulators:auth
  script:
    - npm test
  artifacts:
    when: always
    paths:
      - playwright-report/
    expire_in: 1 week
```

---

## Best Practices

### 1. Test Independence

✅ **Good**: Each test is self-contained
```typescript
test('create order', async ({ page, testUsers }) => {
  // Setup within test
  await loginAs(page, testUsers.client);
  // Test logic
});
```

❌ **Bad**: Tests depend on each other
```typescript
let orderId;
test('create order', async () => {
  orderId = await createOrder(); // Other tests depend on this
});
test('view order', async () => {
  await viewOrder(orderId); // Breaks if first test fails
});
```

### 2. Use Page Object Pattern for Complex Pages

```typescript
// e2e-tests/pages/DashboardPage.ts
export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard');
  }

  async createOrder() {
    await this.page.getByRole('button', { name: /new order/i }).click();
  }

  async getOrderCount() {
    return await this.page.getByRole('row').count() - 1; // Exclude header
  }
}

// In test
import { DashboardPage } from '../pages/DashboardPage';

test('dashboard', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  await dashboard.createOrder();
});
```

### 3. Use Meaningful Selectors

✅ **Good**: Semantic selectors
```typescript
await page.getByRole('button', { name: /submit/i });
await page.getByLabel(/email/i);
await page.getByPlaceholder(/search/i);
```

❌ **Bad**: Brittle selectors
```typescript
await page.locator('.btn-primary-123');
await page.locator('div > div > button:nth-child(3)');
```

### 4. Add Descriptive Test Names

✅ **Good**: Clear intent
```typescript
test('client can place order with multiple items and see confirmation', async () => {
  // ...
});
```

❌ **Bad**: Vague name
```typescript
test('test1', async () => {
  // ...
});
```

### 5. Handle Async Operations

```typescript
// Wait for navigation
await page.getByRole('button').click();
await page.waitForURL('/dashboard');

// Wait for element
await expect(page.getByText('Loading...')).not.toBeVisible();
await expect(page.getByText('Data loaded')).toBeVisible();

// Wait for network
await page.waitForResponse(resp =>
  resp.url().includes('/api/orders') && resp.status() === 200
);
```

### 6. Clean Test Data

The fixture does this automatically, but if you create custom data:

```typescript
test('my test', async ({ page }) => {
  // Test creates data
  const orderId = await createOrder();

  // Clean up in finally
  try {
    // Test logic
  } finally {
    await deleteOrder(orderId);
  }
});
```

### 7. Use Test Hooks Appropriately

```typescript
test.describe('Orders', () => {
  test.beforeEach(async ({ page, testUsers }) => {
    // Runs before each test in this describe block
    await loginAs(page, testUsers.client);
  });

  test.afterEach(async ({ page }) => {
    // Runs after each test
    await page.screenshot({ path: 'screenshot.png' });
  });

  test('test 1', async () => { /* ... */ });
  test('test 2', async () => { /* ... */ });
});
```

---

## Additional Resources

### Documentation

- **Playwright Docs**: https://playwright.dev/
- **Firebase Emulators**: https://firebase.google.com/docs/emulator-suite
- **Testing Best Practices**: https://playwright.dev/docs/best-practices

### Useful Commands Reference

```bash
# Test Execution
npm test                          # Run all tests
npm run test:headed              # With browser visible
npm run test:ui                  # Interactive UI
npm run test:debug               # Debug mode
npx playwright test --grep "auth" # Run specific tests

# Emulator Management
npm run emulators                # Start emulators
npm run emulators:export         # Export emulator data
npm run emulators:import         # Import emulator data
firebase emulators:start --only firestore,auth

# Reports and Debugging
npm run test:report              # View HTML report
npx playwright show-trace <file> # View trace
open test-results/              # View screenshots/videos

# Code Generation
npx playwright codegen localhost:5173  # Record tests

# Update Playwright
npm install --save-dev @playwright/test@latest
npx playwright install
```

### Playwright Selector Cheat Sheet

```typescript
// By role (preferred)
page.getByRole('button', { name: /submit/i })
page.getByRole('textbox', { name: /email/i })
page.getByRole('link', { name: /home/i })

// By label (forms)
page.getByLabel(/password/i)
page.getByLabel('Email address')

// By placeholder
page.getByPlaceholder(/search/i)

// By text
page.getByText('Welcome back')
page.getByText(/hello/i)

// By test ID
page.getByTestId('submit-button')

// Complex selectors
page.locator('button').filter({ hasText: 'Submit' })
page.locator('div').filter({ has: page.locator('button') })
```

---

## Summary

You now have a complete e2e testing setup with:

✅ Firebase emulators for isolated testing
✅ Automatic test data seeding
✅ Playwright for browser automation
✅ Example tests for auth and orders
✅ Debug and development tools
✅ CI/CD ready configuration

### Quick Reference Card

```bash
# Setup (first time)
firebase setup:emulators:firestore
firebase setup:emulators:auth
npm install
npx playwright install chromium

# Development
npm run test:ui          # Interactive development
npm run test:headed      # Watch tests run

# CI/Production
npm test                # Headless execution

# Debugging
npm run test:debug      # Step through tests
npm run test:report     # View results
```

---

**Need Help?**

- Check [Troubleshooting](#troubleshooting) section
- View [Playwright Docs](https://playwright.dev/)
- Check emulator logs at `http://localhost:4000`
- Review test examples in `e2e-tests/specs/`

**Happy Testing! 🚀**
