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
│   ├── auth.spec.ts
│   └── order-creation.spec.ts
├── utils/              # Utility functions
│   ├── firebase-emulator.ts
│   └── test-data.ts
├── global-setup.ts     # Runs before all tests
└── global-teardown.ts  # Runs after all tests
```

## How It Works

1. **Global Setup**: Starts Firebase emulators before any tests run
2. **Test Fixtures**: Each test automatically:
   - Clears emulator data
   - Seeds test data (users, orders, etc.)
   - Runs the test
   - Cleans up after itself
3. **Global Teardown**: Stops emulators after all tests complete

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

## CI/CD Integration

To run tests in CI:

```yaml
- name: Run E2E Tests
  run: |
    npm install
    npm test
```

Tests automatically detect CI environment and adjust settings accordingly.
