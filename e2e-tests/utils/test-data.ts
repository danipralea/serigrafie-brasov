import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectStorageEmulator } from 'firebase/storage';
import { getStorage } from 'firebase/storage';

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
    connectAuthEmulator(testAuth, 'http://localhost:9109', { disableWarnings: true });
    connectFirestoreEmulator(testDb, 'localhost', 8090);
    connectStorageEmulator(testStorage, 'localhost', 9209);
  }

  return { app: testApp, auth: testAuth, db: testDb, storage: testStorage };
}

export interface TestUser {
  email: string;
  password: string;
  displayName: string;
  role?: 'owner' | 'admin' | 'member' | 'user';
}

export const TEST_USERS = {
  admin: {
    email: 'admin@test.com',
    password: 'testpassword123',
    displayName: 'Test Admin',
    role: 'admin' as const
  },
  teamMember: {
    email: 'team@test.com',
    password: 'testpassword123',
    displayName: 'Test Team Member',
    role: 'member' as const
  },
  client: {
    email: 'client@test.com',
    password: 'testpassword123',
    displayName: 'Test Client',
    role: 'user' as const
  }
};

export async function createTestUser(userData: TestUser) {
  const { auth, db } = initializeTestFirebase();

  try {
    // Create user in Auth (this always works, no rules check)
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      userData.email,
      userData.password
    );

    const userId = userCredential.user.uid;

    // Now authenticated as this user, create their profile
    // This respects production rules (users can create their own profile)
    await setDoc(doc(db, 'users', userId), {
      email: userData.email,
      displayName: userData.displayName,
      phoneNumber: null,
      role: userData.role || 'user',
      createdAt: Timestamp.now()
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
  const { auth, db } = initializeTestFirebase();

  // Create test users (this works because Firebase Auth allows signup)
  const admin = await createTestUser(TEST_USERS.admin);
  const teamMember = await createTestUser(TEST_USERS.teamMember);
  const client = await createTestUser(TEST_USERS.client);

  const now = Timestamp.now();

  // Sign in as admin to create data (respects production rules!)
  await signInWithEmailAndPassword(auth, admin.email, admin.password);

  // Create product types (authenticated as admin)
  const productTypes = [
    { id: 'mugs', name: 'Mugs', userId: admin.uid },
    { id: 'tshirts', name: 'T-Shirts', userId: admin.uid },
    { id: 'hoodies', name: 'Hoodies', userId: admin.uid }
  ];

  for (const pt of productTypes) {
    await setDoc(doc(db, 'productTypes', pt.id), {
      name: pt.name,
      description: '',
      userId: pt.userId,
      createdAt: now,
      updatedAt: now
    });
  }

  // Sign in as client to create their order
  await signInWithEmailAndPassword(auth, client.email, client.password);

  // Create a test order (authenticated as client)
  const orderId = 'test-order-1';
  await setDoc(doc(db, 'orders', orderId), {
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

  // Create sub-order (still authenticated as client)
  await setDoc(doc(db, 'orders', orderId, 'subOrders', 'sub-1'), {
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

  // Sign out after seeding
  await auth.signOut();

  return { admin, teamMember, client };
}
