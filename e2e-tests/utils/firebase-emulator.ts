import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

const EMULATOR_PORTS = {
  auth: 9099,
  firestore: 8080,
  storage: 9199,
  functions: 5001,
  ui: 4000
};

export class FirebaseEmulatorManager {
  private emulatorProcess: any = null;

  async start(): Promise<void> {
    console.log('Starting Firebase emulators...');

    // Start emulators in the background
    const { spawn } = require('child_process');
    this.emulatorProcess = spawn('firebase', ['emulators:start'], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'pipe'
    });

    // Wait for emulators to be ready
    await this.waitForEmulators();
    console.log('Firebase emulators are ready!');
  }

  async stop(): Promise<void> {
    if (this.emulatorProcess) {
      console.log('Stopping Firebase emulators...');
      this.emulatorProcess.kill('SIGTERM');
      this.emulatorProcess = null;
    }
  }

  async clearFirestore(): Promise<void> {
    try {
      await fetch(`http://localhost:${EMULATOR_PORTS.firestore}/emulator/v1/projects/serigrafie-brasov/databases/(default)/documents`, {
        method: 'DELETE'
      });
      console.log('Firestore data cleared');
    } catch (error) {
      console.error('Error clearing Firestore:', error);
    }
  }

  async clearAuth(): Promise<void> {
    try {
      await fetch(`http://localhost:${EMULATOR_PORTS.auth}/emulator/v1/projects/serigrafie-brasov/accounts`, {
        method: 'DELETE'
      });
      console.log('Auth data cleared');
    } catch (error) {
      console.error('Error clearing Auth:', error);
    }
  }

  async clearAll(): Promise<void> {
    await Promise.all([
      this.clearFirestore(),
      this.clearAuth()
    ]);
  }

  private async waitForEmulators(maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Check if Firestore emulator is ready
        const response = await fetch(`http://localhost:${EMULATOR_PORTS.firestore}/`);
        if (response.ok) {
          return;
        }
      } catch (error) {
        // Emulator not ready yet
      }

      // Wait 1 second before trying again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Firebase emulators failed to start in time');
  }

  async isRunning(): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${EMULATOR_PORTS.firestore}/`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

export const emulatorManager = new FirebaseEmulatorManager();
