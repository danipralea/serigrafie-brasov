import { FullConfig } from '@playwright/test';
import { emulatorManager } from './utils/firebase-emulator';

async function globalTeardown(config: FullConfig) {
  console.log('🛑 Stopping Firebase emulators...');

  // Stop emulators
  await emulatorManager.stop();

  console.log('✅ Firebase emulators stopped');
}

export default globalTeardown;
