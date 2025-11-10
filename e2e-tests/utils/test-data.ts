import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectStorageEmulator } from 'firebase/storage';
import { getStorage } from 'firebase/storage';
import fetch from 'node-fetch';

// Firebase config for testing
const firebaseConfig = {
  apiKey: "test-api-key",
  authDomain: "serigrafie-brasov.firebaseapp.com",
  projectId: "serigrafie-brasov",
  storageBucket: "serigrafie-brasov.appspot.com",
  messagingSenderId: "test",
  appId: "test-app-id"
};

let testApp: any;
let testAuth: any;
let testDb: any;
let testStorage: any;

export function initializeTestFirebase() {
  if (!testApp) {
    testApp = initializeApp(firebaseConfig, 'test-app');
    testAuth = getAuth(testApp);
    testDb = getFirestore(testApp);
    testStorage = getStorage(testApp);

    // Connect to emulators
    connectAuthEmulator(testAuth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(testDb, 'localhost', 8080);
    connectStorageEmulator(testStorage, 'localhost', 9199);
  }

  return { app: testApp, auth: testAuth, db: testDb, storage: testStorage };
}

export interface TestUser {
  email: string;
  password: string;
  displayName: string;
  isAdmin?: boolean;
  isTeamMember?: boolean;
}

export const TEST_USERS = {
  admin: {
    email: 'admin@test.com',
    password: 'testpassword123',
    displayName: 'Test Admin',
    isAdmin: true,
    isTeamMember: false
  },
  teamMember: {
    email: 'team@test.com',
    password: 'testpassword123',
    displayName: 'Test Team Member',
    isAdmin: false,
    isTeamMember: true
  },
  client: {
    email: 'client@test.com',
    password: 'testpassword123',
    displayName: 'Test Client',
    isAdmin: false,
    isTeamMember: false
  }
};

// Helper function to write to Firestore emulator bypassing security rules
async function writeToEmulator(path: string, data: any) {
  const url = `http://localhost:8080/v1/projects/serigrafie-brasov/databases/(default)/documents/${path}`;

  // Convert data to Firestore format
  const firestoreData: any = { fields: {} };

  for (const [key, value] of Object.entries(data)) {
    if (value === null) {
      firestoreData.fields[key] = { nullValue: null };
    } else if (typeof value === 'string') {
      firestoreData.fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      firestoreData.fields[key] = { integerValue: value.toString() };
    } else if (typeof value === 'boolean') {
      firestoreData.fields[key] = { booleanValue: value };
    } else if (value instanceof Date || (value && typeof value === 'object' && 'seconds' in value)) {
      // Handle Timestamp
      const timestamp = value instanceof Date ? value : new Date(value.seconds * 1000);
      firestoreData.fields[key] = {
        timestampValue: timestamp.toISOString()
      };
    }
  }

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(firestoreData)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to write to emulator: ${response.status} ${text}`);
  }
}

export async function createTestUser(userData: TestUser) {
  const { auth } = initializeTestFirebase();

  try {
    // Create user in Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      userData.email,
      userData.password
    );

    const userId = userCredential.user.uid;

    // Create user profile in Firestore using emulator REST API (bypasses security rules)
    await writeToEmulator(`users/${userId}`, {
      email: userData.email,
      displayName: userData.displayName,
      phoneNumber: null,
      isAdmin: userData.isAdmin || false,
      isTeamMember: userData.isTeamMember || false,
      createdAt: new Date()
    });

    return { uid: userId, ...userData };
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      // User already exists, just sign in
      const userCredential = await signInWithEmailAndPassword(
        auth,
        userData.email,
        userData.password
      );
      return { uid: userCredential.user.uid, ...userData };
    }
    throw error;
  }
}

export async function seedTestData() {
  const { db } = initializeTestFirebase();

  // Create test users
  const admin = await createTestUser(TEST_USERS.admin);
  const teamMember = await createTestUser(TEST_USERS.teamMember);
  const client = await createTestUser(TEST_USERS.client);

  const now = new Date();

  // Create product types using emulator REST API (bypasses security rules)
  const productTypes = [
    { id: 'mugs', name: 'Mugs', userId: admin.uid },
    { id: 'tshirts', name: 'T-Shirts', userId: admin.uid },
    { id: 'hoodies', name: 'Hoodies', userId: admin.uid }
  ];

  for (const pt of productTypes) {
    await writeToEmulator(`productTypes/${pt.id}`, {
      name: pt.name,
      description: '',
      userId: pt.userId,
      createdAt: now,
      updatedAt: now
    });
  }

  // Create a test order
  const orderId = 'test-order-1';
  await writeToEmulator(`orders/${orderId}`, {
    orderName: 'Test Order',
    clientId: client.uid,
    clientName: client.displayName,
    clientEmail: client.email,
    clientPhone: '+40123456789',
    clientCompany: '',
    userId: client.uid,
    userName: client.displayName,
    userEmail: client.email,
    status: 'pending_confirmation',
    createdAt: now,
    updatedAt: now
  });

  // Create sub-order
  await writeToEmulator(`orders/${orderId}/subOrders/sub-1`, {
    userId: client.uid,
    productType: 'mugs',
    productTypeName: 'Mugs',
    productTypeCustom: false,
    quantity: 100,
    length: null,
    width: null,
    cmp: null,
    description: 'White ceramic mugs with logo',
    designFile: '',
    designFilePath: '',
    deliveryTime: '2025-12-01',
    notes: '',
    status: 'pending',
    createdAt: now,
    updatedAt: now
  });

  return { admin, teamMember, client };
}
