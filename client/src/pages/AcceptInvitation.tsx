import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

export default function AcceptInvitation() {
  const { invitationId } = useParams();
  const navigate = useNavigate();
  const { currentUser, loginWithGoogle, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

      // Update invitation status
      const invitationRef = doc(db, 'teamInvitations', invitation.id);
      await updateDoc(invitationRef, {
        status: 'accepted',
        acceptedAt: Timestamp.now(),
        acceptedBy: userCredential.user.uid,
      });

      setSuccess('Invitation accepted successfully!');
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err: any) {
      console.error('Error accepting invitation:', err);

      // Handle specific error cases
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup - don't show error, just reset loading
        console.log('User cancelled Google login');
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Multiple popups opened - don't show error
        console.log('Popup request cancelled');
      } else {
        // Show error for actual failures
        setError('Failed to accept invitation');
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
      // Update invitation status
      const invitationRef = doc(db, 'teamInvitations', invitation.id);
      await updateDoc(invitationRef, {
        status: 'accepted',
        acceptedAt: Timestamp.now(),
        acceptedBy: currentUser.uid,
      });

      setSuccess('Invitation accepted successfully!');
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

      setSuccess('Invitation declined');
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      console.error('Error declining invitation:', err);
      setError('Failed to decline invitation');
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center max-w-md w-full mx-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-vivid-cyan mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg
                className="h-6 w-6 text-red-600"
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h2>
            <p className="text-red-600">{error}</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center max-w-md w-full mx-4">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
          <p className="text-green-600">{success}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Team Invitation</h1>
          {invitation && (
            <p className="text-gray-600">
              You've been invited to join {invitation.invitedByName}'s team
            </p>
          )}
        </div>

        {invitation && (
          <div className="space-y-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Invited by:</span> {invitation.invitedByName}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Email:</span> {invitation.email}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Role:</span>{' '}
                <span className="capitalize">{invitation.role}</span>
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          {!currentUser ? (
            <>
              <button
                onClick={handleGoogleSignInAndAccept}
                disabled={accepting}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                {accepting ? 'Accepting...' : 'Sign in with Google'}
              </button>
              <button
                onClick={handleDecline}
                disabled={accepting}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Decline
              </button>
            </>
          ) : currentUser.email?.toLowerCase() === invitation?.email.toLowerCase() ? (
            <>
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full px-4 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--vivid-cyan)' }}
              >
                {accepting ? 'Accepting...' : 'Accept Invitation'}
              </button>
              <button
                onClick={handleDecline}
                disabled={accepting}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Decline
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  This invitation is for {invitation?.email}. You're currently signed in as {currentUser.email}.
                </p>
              </div>
              <button
                onClick={async () => {
                  await logout();
                  window.location.reload();
                }}
                className="w-full px-4 py-2 rounded-lg text-white font-medium"
                style={{ backgroundColor: 'var(--vivid-cyan)' }}
              >
                Sign Out & Continue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
