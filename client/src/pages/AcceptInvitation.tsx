import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import Navigation from '../components/Navigation';

export default function AcceptInvitation() {
  const { invitationId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser, loginWithGoogle, signup, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showEmailSignup, setShowEmailSignup] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchInvitation();
  }, [invitationId, currentUser]);

  async function fetchInvitation() {
    if (!invitationId) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    try {
      const invitationRef = doc(db, 'teamInvitations', invitationId);
      const invitationSnap = await getDoc(invitationRef);

      if (!invitationSnap.exists()) {
        setError('Invitation not found');
        setLoading(false);
        return;
      }

      const invitationData = {
        id: invitationSnap.id,
        ...invitationSnap.data(),
      };

      if (invitationData.status !== 'pending') {
        setError(`This invitation has already been ${invitationData.status}`);
        setLoading(false);
        return;
      }

      // Check if invitation has expired (7 days)
      const expiryDate = new Date(invitationData.createdAt.toMillis() + 7 * 24 * 60 * 60 * 1000);
      if (new Date() > expiryDate) {
        setError('This invitation has expired');
        setLoading(false);
        return;
      }

      setInvitation(invitationData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching invitation:', err);
      setError('Failed to load invitation');
      setLoading(false);
    }
  }

  async function handleGoogleSignInAndAccept() {
    if (!invitation) return;

    setAccepting(true);
    setError('');

    try {
      const userCredential = await loginWithGoogle();

      // Check if the Google account email matches the invitation email
      if (userCredential.user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        setError(`Please sign in with ${invitation.email}`);
        setAccepting(false);
        return;
      }

      // Update user profile to mark as team member
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      await updateDoc(userDocRef, {
        isTeamMember: true,
        teamOwnerId: invitation.invitedBy,
      });

      // Update invitation status
      const invitationRef = doc(db, 'teamInvitations', invitation.id);
      await updateDoc(invitationRef, {
        status: 'accepted',
        acceptedAt: Timestamp.now(),
        acceptedBy: userCredential.user.uid,
      });

      setSuccess(t('acceptInvitation.acceptedSuccess'));
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err: any) {
      console.error('Error accepting invitation:', err);

      // Handle specific error cases
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup - don't show error, just reset loading
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Multiple popups opened - don't show error
      } else {
        // Show error for actual failures
        setError(t('acceptInvitation.failedToAccept'));
      }
    } finally {
      setAccepting(false);
    }
  }

  async function handleEmailSignupAndAccept() {
    if (!invitation) return;

    // Validate passwords
    if (password.length < 6) {
      setError(t('acceptInvitation.passwordTooShort'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('acceptInvitation.passwordsDoNotMatch'));
      return;
    }

    setAccepting(true);
    setError('');

    try {
      // Create account with the invitation email
      const userCredential = await signup(invitation.email, password);

      // Update user profile to mark as team member
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      await updateDoc(userDocRef, {
        isTeamMember: true,
        teamOwnerId: invitation.invitedBy,
      });

      // Update invitation status
      const invitationRef = doc(db, 'teamInvitations', invitation.id);
      await updateDoc(invitationRef, {
        status: 'accepted',
        acceptedAt: Timestamp.now(),
        acceptedBy: userCredential.user.uid,
      });

      setSuccess(t('acceptInvitation.accountCreated'));
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err: any) {
      console.error('Error creating account:', err);

      if (err.code === 'auth/email-already-in-use') {
        setError(t('acceptInvitation.emailAlreadyExists'));
      } else if (err.code === 'auth/weak-password') {
        setError(t('acceptInvitation.passwordTooWeak'));
      } else {
        setError(t('acceptInvitation.failedToCreateAccount'));
      }
    } finally {
      setAccepting(false);
    }
  }

  async function handleAccept() {
    if (!invitation || !currentUser) return;

    setAccepting(true);
    setError('');

    try {
      // Update user profile to mark as team member
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        isTeamMember: true,
        teamOwnerId: invitation.invitedBy,
      });

      // Update invitation status
      const invitationRef = doc(db, 'teamInvitations', invitation.id);
      await updateDoc(invitationRef, {
        status: 'accepted',
        acceptedAt: Timestamp.now(),
        acceptedBy: currentUser.uid,
      });

      setSuccess(t('acceptInvitation.acceptedSuccess'));
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setError('Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  }

  async function handleDecline() {
    if (!invitation) return;

    setAccepting(true);
    setError('');

    try {
      const invitationRef = doc(db, 'teamInvitations', invitation.id);
      await updateDoc(invitationRef, {
        status: 'declined',
        declinedAt: Timestamp.now(),
        declinedBy: currentUser?.uid || null,
      });

      setSuccess(t('acceptInvitation.declined'));
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      console.error('Error declining invitation:', err);
      setError(t('acceptInvitation.failedToDecline'));
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <>
        <Navigation variant="public" />
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center transition-colors">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8 text-center max-w-md w-full mx-4 transition-colors">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-vivid-cyan mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-slate-400">{t('acceptInvitation.loadingInvitation')}</p>
          </div>
        </div>
      </>
    );
  }

  if (error && !invitation) {
    return (
      <>
        <Navigation variant="public" />
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center transition-colors">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8 max-w-md w-full mx-4 transition-colors">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                <svg
                  className="h-6 w-6 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('acceptInvitation.invalidInvitation')}</h2>
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-full px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-slate-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      </>
    );
  }

  if (success) {
    return (
      <>
        <Navigation variant="public" />
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center transition-colors">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8 text-center max-w-md w-full mx-4 transition-colors">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <svg
                className="h-6 w-6 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('acceptInvitation.success')}</h2>
            <p className="text-green-600 dark:text-green-400">{success}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation variant="public" />
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4 transition-colors">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8 max-w-md w-full transition-colors">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('acceptInvitation.teamInvitation')}</h1>
          {invitation && (
            <p className="text-gray-600 dark:text-slate-400">
              You've been invited to join {invitation.invitedByName}'s team
            </p>
          )}
        </div>

        {invitation && (
          <div className="space-y-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-800/50 transition-colors">
              <p className="text-sm text-gray-700 dark:text-slate-300">
                <span className="font-medium">{t('acceptInvitation.invitedBy')}:</span> {invitation.invitedByName}
              </p>
              <p className="text-sm text-gray-700 dark:text-slate-300">
                <span className="font-medium">{t('acceptInvitation.email')}:</span> {invitation.email}
              </p>
              <p className="text-sm text-gray-700 dark:text-slate-300">
                <span className="font-medium">{t('acceptInvitation.role')}:</span>{' '}
                <span className="capitalize">{invitation.role}</span>
              </p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300 rounded-lg p-4 text-sm transition-colors">
                {error}
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          {!currentUser ? (
            <>
              {!showEmailSignup ? (
                <>
                  <button
                    onClick={handleGoogleSignInAndAccept}
                    disabled={accepting}
                    className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm bg-white dark:bg-slate-700 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
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
                    {accepting ? t('acceptInvitation.accepting') : t('acceptInvitation.signInWithGoogle')}
                  </button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300 dark:border-slate-600"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400">{t('acceptInvitation.or')}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowEmailSignup(true)}
                    disabled={accepting}
                    className="w-full px-4 py-2 bg-vivid-cyan text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('acceptInvitation.createAccountWithEmail')}
                  </button>

                  <button
                    onClick={handleDecline}
                    disabled={accepting}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-slate-300 font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    {t('acceptInvitation.decline')}
                  </button>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        {t('acceptInvitation.email')}
                      </label>
                      <input
                        type="email"
                        value={invitation?.email || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-slate-400 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        {t('acceptInvitation.password')}
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('acceptInvitation.enterPassword')}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-vivid-cyan transition-colors placeholder:text-gray-400 dark:placeholder:text-slate-500"
                        disabled={accepting}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        {t('acceptInvitation.confirmPassword')}
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t('acceptInvitation.enterConfirmPassword')}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-vivid-cyan transition-colors placeholder:text-gray-400 dark:placeholder:text-slate-500"
                        disabled={accepting}
                      />
                    </div>

                    <button
                      onClick={handleEmailSignupAndAccept}
                      disabled={accepting || !password || !confirmPassword}
                      className="w-full px-4 py-2 bg-vivid-cyan text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {accepting ? t('acceptInvitation.creatingAccount') : t('acceptInvitation.createAccountAndAccept')}
                    </button>

                    <button
                      onClick={() => {
                        setShowEmailSignup(false);
                        setPassword('');
                        setConfirmPassword('');
                        setError('');
                      }}
                      disabled={accepting}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-slate-300 font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      {t('acceptInvitation.back')}
                    </button>
                  </div>
                </>
              )}
            </>
          ) : currentUser.email?.toLowerCase() === invitation?.email.toLowerCase() ? (
            <>
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full px-4 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--vivid-cyan)' }}
              >
                {accepting ? t('acceptInvitation.accepting') : t('acceptInvitation.acceptInvitation')}
              </button>
              <button
                onClick={handleDecline}
                disabled={accepting}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-slate-300 font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Decline
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-4 transition-colors">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  This invitation is for {invitation?.email}. You're currently signed in as {currentUser.email}.
                </p>
              </div>
              <button
                onClick={async () => {
                  await logout();
                  window.location.reload();
                }}
                className="w-full px-4 py-2 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--vivid-cyan)' }}
              >
                {t('acceptInvitation.signOutAndContinue')}
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
