import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('✅ Test run completed');
  console.log('');
  console.log('Note: Firebase emulators are still running.');
  console.log('Stop them with Ctrl+C in the emulator terminal.');
}

export default globalTeardown;
