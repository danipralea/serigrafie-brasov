import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthModal({ isOpen, onClose, onSuccess }) {
  const { login, loginWithGoogle, loginWithPhone } = useAuth();
  const [authMode, setAuthMode] = useState('options'); // 'options', 'email', 'phone', 'phone-verify'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAuthMode('options');
      setEmail('');
      setPassword('');
      setPhone('');
      setVerificationCode('');
      setConfirmationResult(null);
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleGoogleSignIn() {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      onSuccess();
    } catch (err: any) {
      console.error('Google sign in error:', err);

      // Handle specific error cases
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup - don't show error, just reset loading
        console.log('User cancelled Google login');
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Multiple popups opened - don't show error
        console.log('Popup request cancelled');
      } else {
        // Show error for actual failures
        setError('Failed to sign in with Google');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSignIn(e) {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      onSuccess();
    } catch (err) {
      console.error('Email sign in error:', err);
      setError('Failed to sign in. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoneSendCode() {
    try {
      setError('');
      setLoading(true);

      // Format phone number to E.164 format
      let formattedPhone = phone.trim();

      // Remove any spaces, dashes, or parentheses
      formattedPhone = formattedPhone.replace(/[\s\-\(\)]/g, '');

      // If it starts with 0, replace with +40 (Romania)
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+40' + formattedPhone.substring(1);
      }

      // If it doesn't start with +, add +40
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+40' + formattedPhone;
      }

      // Format to match Firebase's format: +40 746 923 196
      // Extract the digits after +40
      if (formattedPhone.startsWith('+40')) {
        const digits = formattedPhone.substring(3);
        // Add spaces every 3 digits: 746 923 196
        const formatted = digits.match(/.{1,3}/g)?.join(' ') || digits;
        formattedPhone = '+40 ' + formatted;
      }

      console.log('Sending verification code to:', formattedPhone);

      const confirmation = await loginWithPhone(formattedPhone);
      setConfirmationResult(confirmation);
      setAuthMode('phone-verify');
    } catch (err: any) {
      console.error('Phone sign in error:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);

      // Provide more specific error messages
      if (err.code === 'auth/invalid-phone-number') {
        setError('Număr de telefon invalid. Folosește formatul: 0746923196 sau +40746923196');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Prea multe încercări. Te rugăm să aștepți câteva minute.');
      } else if (err.code === 'auth/quota-exceeded') {
        setError('Limita de SMS-uri a fost depășită. Contactează administratorul.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Trimiterea SMS-urilor către România nu este activată încă. Contactează administratorul pentru a activa această funcție sau folosește Email/Google pentru autentificare.');
      } else {
        setError(`Eroare la trimiterea codului: ${err.message || 'Te rugăm să încerci din nou.'}`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoneVerify(e) {
    e.preventDefault();
    if (!confirmationResult) return;

    try {
      setError('');
      setLoading(true);
      await confirmationResult.confirm(verificationCode);
      onSuccess();
    } catch (err) {
      console.error('Phone verification error:', err);
      setError('Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
              {authMode === 'options' ? 'Autentifică-te pentru a continua' :
               authMode === 'phone-verify' ? 'Verificare telefon' : 'Autentificare'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg p-3 text-sm transition-colors">
              {error}
            </div>
          )}

          {authMode === 'options' && (
            <div className="space-y-3">
              <p className="text-gray-600 dark:text-slate-300 mb-4 transition-colors">
                Pentru a plasa o comandă, trebuie să te autentifici. Alege una din opțiunile de mai jos:
              </p>

              {/* Google Sign In */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="font-medium text-gray-700 dark:text-slate-200">Continuă cu Google</span>
              </button>

              {/* Email/Password Option */}
              <button
                onClick={() => {
                  setAuthMode('email');
                  setError('');
                }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="font-medium text-gray-700 dark:text-slate-200">Continuă cu Email</span>
              </button>

              {/* Phone Option */}
              <button
                onClick={() => setAuthMode('phone')}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="font-medium text-gray-700 dark:text-slate-200">Continuă cu Telefon</span>
              </button>
            </div>
          )}

          {authMode === 'email' && (
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                  Parolă
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('options');
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-slate-200 font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Înapoi
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-lg text-white font-medium bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Se autentifică...' : 'Autentificare'}
                </button>
              </div>
            </form>
          )}

          {authMode === 'phone' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-slate-300 mb-4">
                Introdu numărul tău de telefon pentru a te autentifica.
              </p>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                  Număr de telefon
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
                  placeholder="0746923196"
                />
              </div>
              <div id="recaptcha-container"></div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('options');
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-slate-200 font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Înapoi
                </button>
                <button
                  type="button"
                  disabled={!phone || loading}
                  className="flex-1 px-4 py-2 rounded-lg text-white font-medium bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handlePhoneSendCode}
                >
                  {loading ? 'Se trimite...' : 'Continuă'}
                </button>
              </div>
            </div>
          )}

          {authMode === 'phone-verify' && (
            <form onSubmit={handlePhoneVerify} className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-slate-300 mb-4">
                Introdu codul de verificare trimis la numărul {phone}
              </p>
              <div>
                <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                  Cod de verificare
                </label>
                <input
                  type="text"
                  id="verificationCode"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-cyan-500"
                  placeholder="123456"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('phone');
                    setVerificationCode('');
                    setConfirmationResult(null);
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-slate-200 font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Înapoi
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-lg text-white font-medium bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Se verifică...' : 'Verifică'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
