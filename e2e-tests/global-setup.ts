import { chromium, FullConfig } from '@playwright/test';
import { emulatorManager } from './utils/firebase-emulator';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Firebase emulators for e2e tests...');

  // Start emulators
  await emulatorManager.start();

  console.log('✅ Firebase emulators started successfully');
}

export default globalSetup;
