import { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

// Extend window type to include recaptchaVerifier
declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

const AuthContext = createContext<any>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        // Fetch or create user profile
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const existingProfile = userDoc.data();

          // Update profile if phone number is missing but user has one
          if (user.phoneNumber && !existingProfile.phoneNumber) {
            const updatedProfile = {
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

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }

  async function logout() {
    return signOut(auth);
  }

  async function sendPasswordResetEmail(email) {
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
        setUserProfile(userDoc.data());
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
