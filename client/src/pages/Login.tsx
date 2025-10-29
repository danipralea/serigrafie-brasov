import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import PhoneAuthModal from '../components/PhoneAuthModal';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showPhoneAuth, setShowPhoneAuth] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const { login, loginWithGoogle, sendPasswordResetEmail } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Apply dark mode based on saved preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('themeMode') || 'system';
    const html = document.documentElement;

    if (savedTheme === 'dark') {
      html.classList.add('dark');
    } else if (savedTheme === 'light') {
      html.classList.remove('dark');
    } else {
      // System preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemPrefersDark) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!email || !password) {
      setError(t('login.errorAllFields'));
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError(t('login.errorInvalidCredentials'));
      } else if (err.code === 'auth/invalid-email') {
        setError(t('login.errorInvalidEmail'));
      } else {
        setError(t('login.errorLoginFailed'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      setError('');
      setGoogleLoading(true);
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Google login error:', err);

      // Handle specific error cases
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup - don't show error, just reset loading
        console.log('User cancelled Google login');
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Multiple popups opened - don't show error
        console.log('Popup request cancelled');
      } else {
        // Show error for actual failures
        setError(t('login.errorGoogleLogin'));
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handlePasswordReset(e) {
    e.preventDefault();

    if (!resetEmail) {
      setError(t('login.errorAllFields'));
      return;
    }

    try {
      setError('');
      setLoading(true);
      await sendPasswordResetEmail(resetEmail);
      setResetSuccess(true);
      setTimeout(() => {
        setShowResetPassword(false);
        setResetSuccess(false);
        setResetEmail('');
      }, 3000);
    } catch (err) {
      console.error('Password reset error:', err);
      setError(t('login.resetEmailError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-900 transition-colors">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1
          onClick={() => navigate('/')}
          className="text-center text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity"
        >
          {t('landing.title')}
        </h1>
        <h2 className="mt-6 text-center text-2xl/9 font-bold tracking-tight text-slate-900 dark:text-white">
          {showResetPassword ? t('login.resetPassword') : t('login.title')}
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
        <div className="bg-white dark:bg-slate-800 px-6 py-12 shadow-sm sm:rounded-lg sm:px-12 border border-slate-200 dark:border-slate-700 transition-colors">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm">
              {error}
            </div>
          )}

          {resetSuccess && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 text-sm">
              {t('login.resetEmailSent')}
            </div>
          )}

          {showResetPassword ? (
            /* Password Reset Form */
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                {t('login.resetPasswordDesc')}
              </p>
              <form onSubmit={handlePasswordReset} className="space-y-6">
                <div>
                  <label htmlFor="reset-email" className="block text-sm/6 font-medium text-slate-900 dark:text-slate-100">
                    {t('login.email')}
                  </label>
                  <div className="mt-2">
                    <input
                      id="reset-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-1.5 text-base text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 sm:text-sm/6"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full justify-center rounded-md px-3 py-1.5 text-sm/6 font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-xs hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? t('login.signingIn') : t('login.sendResetLink')}
                  </button>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetPassword(false);
                      setError('');
                      setResetEmail('');
                    }}
                    className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    {t('login.backToLogin')}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Login Form */
            <>
            <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm/6 font-medium text-slate-900 dark:text-slate-100">
                {t('login.email')}
              </label>
              <div className="mt-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-1.5 text-base text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 sm:text-sm/6"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm/6 font-medium text-slate-900 dark:text-slate-100">
                {t('login.password')}
              </label>
              <div className="mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-1.5 text-base text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 sm:text-sm/6"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <div className="flex h-6 shrink-0 items-center">
                  <div className="group grid size-4 grid-cols-1">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="col-start-1 row-start-1 appearance-none rounded-sm border border-gray-300 bg-white checked:border-indigo-600 checked:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    />
                    <svg
                      fill="none"
                      viewBox="0 0 14 14"
                      className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white"
                    >
                      <path
                        d="M3 8L6 11L11 3.5"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-0 group-has-[:checked]:opacity-100"
                      />
                    </svg>
                  </div>
                </div>
                <label htmlFor="remember-me" className="block text-sm/6 text-slate-900 dark:text-slate-100">
                  {t('login.rememberMe')}
                </label>
              </div>

              <div className="text-sm/6">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPassword(true);
                    setError('');
                  }}
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  {t('login.forgotPassword')}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md px-3 py-1.5 text-sm/6 font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 shadow-xs hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('login.signingIn') : t('login.signIn')}
              </button>
            </div>
          </form>

          <div>
            <div className="mt-10 flex items-center gap-x-6">
              <div className="w-full flex-1 border-t border-gray-200 dark:border-slate-600" />
              <p className="text-sm/6 font-medium text-nowrap text-slate-900 dark:text-slate-100">{t('login.orContinueWith')}</p>
              <div className="w-full flex-1 border-t border-gray-200 dark:border-slate-600" />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                  <path
                    d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z"
                    fill="#EA4335"
                  />
                  <path
                    d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.2654 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z"
                    fill="#34A853"
                  />
                </svg>
                <span className="text-sm/6 font-semibold">{t('login.google')}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPhoneAuth(true)}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="text-sm/6 font-semibold">{t('login.phone')}</span>
              </button>
            </div>

            {/* Google Loading Message */}
            {googleLoading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400"></div>
                <span>{t('login.waitingForGoogle')}</span>
              </div>
            )}
          </div>
          </>
          )}
        </div>

        {/* Phone Auth Modal */}
        <PhoneAuthModal
          open={showPhoneAuth}
          onClose={() => setShowPhoneAuth(false)}
          onSuccess={() => navigate('/dashboard')}
        />

        {!showResetPassword && (
          <p className="mt-10 text-center text-sm/6 text-gray-500 dark:text-slate-400">
            {t('login.notAMember')}{' '}
            <a
              onClick={() => navigate('/place-order')}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer"
            >
              {t('login.placeAnOrder')}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
