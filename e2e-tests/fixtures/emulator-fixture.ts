import { test as base } from '@playwright/test';
import { emulatorManager } from '../utils/firebase-emulator';
import { seedTestData, TEST_USERS } from '../utils/test-data';

type EmulatorFixtures = {
  emulators: void;
  testUsers: typeof TEST_USERS;
};

export const test = base.extend<EmulatorFixtures>({
  emulators: [async ({}, use) => {
    // Setup: Ensure emulators are running
    const isRunning = await emulatorManager.isRunning();
    if (!isRunning) {
      await emulatorManager.start();
    }

    // Clear data before each test
    await emulatorManager.clearAll();

    // Seed test data
    await seedTestData();

    await use();

    // Teardown: Clear data after test
    await emulatorManager.clearAll();
  }, { auto: true }], // auto: true means this fixture runs automatically for every test

  testUsers: async ({}, use) => {
    await use(TEST_USERS);
  }
});

export { expect } from '@playwright/test';
