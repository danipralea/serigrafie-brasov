import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { sendTeamInvitationEmail, createInvitationLink } from '../services/emailService';
import { TeamRole } from '../types';

export default function InviteTeamModal({ isOpen, onClose, onInvitationCreated, existingEmails = [] }) {
  const { currentUser } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(TeamRole.MEMBER);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invitationLink, setInvitationLink] = useState('');

  // Handle Escape key to close modal
  useEffect(() => {
    function handleEscapeKey(event) {
      if (event.key === 'Escape' && isOpen) {
        handleClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [isOpen]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!email || !role) {
      setError(t('team.inviteModal.errorAllFields'));
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t('team.inviteModal.errorInvalidEmail'));
      return;
    }

    // Check for duplicate email
    const normalizedEmail = email.toLowerCase();
    if (existingEmails.map(e => e.toLowerCase()).includes(normalizedEmail)) {
      setError(t('team.inviteModal.errorDuplicateEmail'));
      return;
    }

    try {
      setError('');
      setSuccess('');
      setLoading(true);

      // Create invitation in Firestore
      const invitationsRef = collection(db, 'teamInvitations');
      const invitationDoc = await addDoc(invitationsRef, {
        email: email.toLowerCase(),
        role,
        invitedBy: currentUser.uid,
        invitedByName: currentUser.displayName || currentUser.email || 'Team Owner',
        invitedByEmail: currentUser.email || '',
        teamOwnerId: currentUser.uid,
        status: 'pending',
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days
      });

      // Create invitation link
      const link = createInvitationLink(invitationDoc.id);
      setInvitationLink(link);

      // Send invitation email
      try {
        await sendTeamInvitationEmail({
          email: email.toLowerCase(),
          inviterName: currentUser.displayName || currentUser.email || 'Team Owner',
          inviterEmail: currentUser.email || '',
          role,
          invitationLink: link,
        });
        setSuccess(`${t('team.inviteModal.invitationSent')} ${email}!`);
      } catch (emailError) {
        // Email failed but invitation was created
        setSuccess(`${t('team.inviteModal.invitationCreated')} ${email}:`);
      }

      // Reset form
      setEmail('');
      setRole(TeamRole.MEMBER);

      // Notify parent to refresh
      if (onInvitationCreated) {
        onInvitationCreated();
      }
    } catch (err) {
      console.error('Error creating invitation:', err);
      setError(t('team.inviteModal.errorFailed'));
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setEmail('');
    setRole(TeamRole.MEMBER);
    setError('');
    setSuccess('');
    setInvitationLink('');
    onClose();
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(invitationLink);
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Blurred Background Overlay */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6 pointer-events-auto transform transition-all shadow-xl border border-slate-200 dark:border-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('team.inviteModal.title')}</h3>
            <button
              onClick={handleClose}
              className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 rounded-lg p-3 text-sm">
              <p className="mb-2">{success}</p>
              {invitationLink && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={invitationLink}
                      readOnly
                      className="flex-1 px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-green-300 dark:border-green-700 text-gray-900 dark:text-white rounded"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="px-2 py-1 text-xs bg-green-600 dark:bg-green-700 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                    >
                      {t('team.inviteModal.copyButton')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                {t('team.inviteModal.emailLabel')}
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('team.inviteModal.emailPlaceholder')}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                {t('team.inviteModal.roleLabel')}
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                <option value={TeamRole.MEMBER}>{t('team.inviteModal.memberRole')}</option>
                <option value={TeamRole.ADMIN}>{t('team.inviteModal.adminRole')}</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-slate-300 font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                {t('team.inviteModal.cancelButton')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium transition-opacity hover:opacity-90 disabled:opacity-50 focus:outline-none"
              >
                {loading ? t('team.inviteModal.sendingButton') : t('team.inviteModal.sendButton')}
              </button>
            </div>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {t('team.inviteModal.expiryNote')}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
