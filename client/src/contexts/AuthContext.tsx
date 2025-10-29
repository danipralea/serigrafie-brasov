import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  User,
  ConfirmationResult
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

// Extend window type to include recaptchaVerifier
declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

interface UserProfile {
  email: string | null;
  phoneNumber?: string | null;
  displayName: string | null;
  isTeamMember: boolean;
  isAdmin: boolean;
  createdAt: Date;
  photoURL?: string | null;
  teamOwnerId?: string;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  login: (email: string, password: string) => Promise<any>;
  loginWithGoogle: () => Promise<any>;
  logout: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  setupRecaptcha: (containerId: string) => RecaptchaVerifier | null;
  loginWithPhone: (phoneNumber: string) => Promise<ConfirmationResult>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        // Fetch or create user profile
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const existingProfile = userDoc.data() as UserProfile;

          // Update profile if phone number is missing but user has one
          if (user.phoneNumber && !existingProfile.phoneNumber) {
            const updatedProfile: UserProfile = {
              ...existingProfile,
              phoneNumber: user.phoneNumber
            };
            await setDoc(userDocRef, updatedProfile, { merge: true });
            setUserProfile(updatedProfile);
          } else {
            setUserProfile(existingProfile);
          }
        } else {
          // Create new user profile
          const newProfile = {
            email: user.email,
            phoneNumber: user.phoneNumber,
            displayName: user.displayName || user.email || user.phoneNumber,
            isTeamMember: false,
            isAdmin: false,
            createdAt: new Date()
          };
          await setDoc(userDocRef, newProfile);
          setUserProfile(newProfile);
        }
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function login(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }

  async function logout() {
    return signOut(auth);
  }

  async function sendPasswordResetEmail(email: string) {
    return firebaseSendPasswordResetEmail(auth, email);
  }

  function setupRecaptcha(containerId: string) {
    if (!window.recaptchaVerifier) {
      const container = document.getElementById(containerId);
      if (!container) {
        console.error('reCAPTCHA container not found:', containerId);
        return null;
      }

      window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: 'normal',
        callback: () => {
          // reCAPTCHA solved - user verified
          console.log('reCAPTCHA verified');
        },
        'expired-callback': () => {
          // Response expired. Ask user to solve reCAPTCHA again.
          console.log('reCAPTCHA expired');
        }
      });

      // Render immediately
      window.recaptchaVerifier.render().then((widgetId) => {
        console.log('reCAPTCHA rendered with widget ID:', widgetId);
      }).catch((error) => {
        console.error('Error rendering reCAPTCHA:', error);
      });
    }
    return window.recaptchaVerifier;
  }

  async function loginWithPhone(phoneNumber: string) {
    const recaptchaVerifier = setupRecaptcha('recaptcha-container');
    if (!recaptchaVerifier) {
      throw new Error('reCAPTCHA verification failed to initialize');
    }
    return signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
  }

  async function refreshUserProfile() {
    if (currentUser) {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        setUserProfile(userDoc.data() as UserProfile);
      }
    }
  }

  const value = {
    currentUser,
    userProfile,
    login,
    loginWithGoogle,
    logout,
    sendPasswordResetEmail,
    setupRecaptcha,
    loginWithPhone,
    refreshUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
