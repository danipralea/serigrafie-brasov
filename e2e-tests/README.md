# E2E Testing with Firebase Emulators

This directory contains end-to-end tests for the Serigrafie Brasov application using Playwright and Firebase emulators.

## Setup

The e2e testing infrastructure has already been installed. All dependencies are in the root `package.json`.

## Running Tests

### Prerequisites

1. Make sure Firebase emulators are installed:
```bash
firebase setup:emulators:firestore
# Note: Auth and Storage emulators are downloaded automatically
```

### Run Tests

From the project root:

```bash
# Run all tests (headless mode)
npm test

# Run tests in headed mode (see browser)
npm run test:headed

# Run tests in UI mode (interactive)
npm run test:ui

# Debug tests
npm run test:debug

# View test report
npm run test:report
```

### Manual Emulator Control

If you want to run emulators manually:

```bash
# Start emulators
npm run emulators

# Access Emulator UI at http://localhost:4000
```

## Test Structure

```
e2e-tests/
├── fixtures/           # Playwright fixtures for test setup
│   └── emulator-fixture.ts
├── specs/              # Test files
│   ├── auth.spec.ts           # Authentication flow tests
│   ├── order-creation.spec.ts # Basic order creation tests
│   └── order-workflow.spec.ts # Complete order workflow (tandem testing)
├── utils/              # Utility functions
│   ├── firebase-emulator.ts   # Emulator management utilities
│   └── test-data.ts           # Test data seeding functions
├── global-setup.ts     # Runs before all tests
└── global-teardown.ts  # Runs after all tests
```

## How It Works

1. **Production Rules**: Tests use your production Firestore security rules without modification. This ensures that:
   - Tests validate that your security rules work correctly
   - No special test rules or rule swapping is needed
   - Your production rules are continuously tested

2. **Authenticated Seeding**: Test data is created using authenticated Firebase SDK calls:
   - Users are created via Firebase Auth (which has no security rules)
   - Each user is automatically authenticated after creation
   - Data is then created while authenticated as the appropriate user (admin creates product types, client creates orders)
   - This respects production security rules throughout the seeding process

3. **Test Fixtures**: Each test automatically:
   - Clears emulator data (Auth and Firestore)
   - Seeds test data (users, orders, etc.) using authenticated calls
   - Runs the test with authentication enforced
   - Cleans up after itself

4. **Emulator Control**: Emulators must be started manually before running tests (see "Manual Emulator Control" section)

## Test Data

Test users are automatically created for each test:

- **Admin**: `admin@test.com` / `testpassword123`
- **Team Member**: `team@test.com` / `testpassword123`
- **Client**: `client@test.com` / `testpassword123`

Sample orders and product types are also seeded.

## Writing New Tests

1. Create a new file in `specs/` directory (e.g., `my-feature.spec.ts`)
2. Import the test fixture:
   ```typescript
   import { test, expect } from '../fixtures/emulator-fixture';
   ```
3. Write your tests:
   ```typescript
   test.describe('My Feature', () => {
     test('should do something', async ({ page, testUsers }) => {
       // Your test code here
       // testUsers contains admin, teamMember, client credentials
     });
   });
   ```

## Emulator Ports

- Firestore: `localhost:8080`
- Auth: `localhost:9099`
- Storage: `localhost:9199`
- Functions: `localhost:5001`
- Emulator UI: `localhost:4000`

## Troubleshooting

### Emulators not starting

Make sure you have Java installed (required for Firestore emulator):
```bash
java -version
```

### Tests timing out

Increase timeout in `playwright.config.ts`:
```typescript
timeout: 90000, // 90 seconds
```

### Port already in use

Check if emulators are already running:
```bash
lsof -i :8080  # Check Firestore port
```

Kill the process if needed:
```bash
kill -9 <PID>
```

## Tandem Testing (Complete Order Workflow)

The `order-workflow.spec.ts` test suite demonstrates tandem testing - validating a complete workflow across multiple user roles:

### Test: Complete Order Workflow

1. **Client creates order:**
   - Login as client
   - Navigate to Place Order page
   - Fill out order form (phone, product type, quantity, delivery time, description)
   - Submit order
   - Verify redirect to dashboard

2. **Verify in client dashboard:**
   - Check order appears in table
   - Verify client name is displayed
   - Verify status is "așteaptă confirmare" (pending confirmation)

3. **Switch to admin view:**
   - Logout as client
   - Login as admin
   - Verify admin can access dashboard
   - Check dashboard functionality

4. **Verify persistence:**
   - Logout as admin
   - Login back as client
   - Verify order still exists with correct details

### Test: Team Member Access

Validates that team members can access the dashboard and view orders according to team ownership rules.

### What Makes This "Tandem" Testing?

- Tests the **same order** from **multiple user perspectives**
- Validates **data consistency** across user roles
- Ensures **security rules** work correctly (admin doesn't see client orders unless authorized)
- Simulates **real-world workflow**: client creates → team processes

## CI/CD Integration

### GitHub Actions Setup

This project includes pre-configured GitHub Actions workflows in `.github/workflows/`:

1. **`e2e-tests.yml`** - Runs all e2e tests with Firebase emulators
   - Triggers on push/PR to main, develop, or feature/e2e-tests branches
   - Sets up Node.js, Java, Firebase CLI, and Playwright
   - Starts emulators in background
   - Runs all 8 tests
   - **Only uploads artifacts and sends notifications on failure**

2. **`ci.yml`** - Quick build validation
   - Type checks and builds client and functions
   - Faster feedback (~2-3 minutes)

### Notification Strategy

**✅ Tests pass** → Green checkmark, no emails, no noise

**❌ Tests fail** → Email notification + detailed artifacts (screenshots, traces, HTML report)

**Configure your notifications** to only receive emails on failures:
1. Go to https://github.com/settings/notifications
2. Under **Actions**, select **Failed workflows only**

See `.github/NOTIFICATIONS.md` for detailed setup instructions.

### What CI Does

```bash
# Automatically runs on every push:
1. Install dependencies (cached for speed)
2. Start Firebase emulators (Auth, Firestore, Storage, Functions)
3. Run all e2e tests (headless Chrome)
4. Generate reports (only on failure)
5. Comment on PR (only on failure)
6. Upload artifacts (only on failure)
```

### Manual Workflow Triggers

You can run workflows manually from the **Actions** tab:
1. Select **E2E Tests** workflow
2. Click **Run workflow**
3. Choose branch

Tests automatically detect CI environment and adjust settings accordingly.
