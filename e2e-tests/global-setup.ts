import { chromium, FullConfig } from '@playwright/test';
import { emulatorManager } from './utils/firebase-emulator';

async function globalSetup(config: FullConfig) {
  console.log('🔍 Checking if Firebase emulators are running...');

  // Check if emulators are already running
  const isRunning = await emulatorManager.isRunning();

  if (!isRunning) {
    console.log('');
    console.log('❌ Firebase emulators are not running!');
    console.log('');
    console.log('Please start the emulators in a separate terminal:');
    console.log('  npm run emulators');
    console.log('');
    console.log('Or use the start script:');
    console.log('  ./scripts/start-test-env.sh');
    console.log('');
    throw new Error('Firebase emulators must be running before tests');
  }

  console.log('✅ Firebase emulators are running');
}

export default globalSetup;
