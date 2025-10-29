import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { TeamRole } from '../types';
import InviteTeamModal from '../components/InviteTeamModal';
import ConfirmDialog from '../components/ConfirmDialog';
import AppShell from '../components/AppShell';

export default function TeamManagement() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [teamMembers, setTeamMembers] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedInvitationId, setSelectedInvitationId] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState(null);

  useEffect(() => {
    fetchTeamData();
  }, [currentUser]);

  async function fetchTeamData() {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Fetch pending invitations
      const invitationsRef = collection(db, 'teamInvitations');
      const invitationsQuery = query(
        invitationsRef,
        where('teamOwnerId', '==', currentUser.uid),
        where('status', '==', 'pending')
      );
      const invitationsSnapshot = await getDocs(invitationsQuery);
      const invitations = invitationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        // Sort by createdAt desc manually
        return b.createdAt?.toMillis() - a.createdAt?.toMillis();
      });
      setPendingInvitations(invitations);

      // Fetch accepted team members (you would need a teamMembers collection for this)
      // For now, we'll show accepted invitations as team members
      const acceptedQuery = query(
        invitationsRef,
        where('teamOwnerId', '==', currentUser.uid),
        where('status', '==', 'accepted')
      );
      const acceptedSnapshot = await getDocs(acceptedQuery);
      const members = acceptedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        // Sort by acceptedAt desc manually
        return b.acceptedAt?.toMillis() - a.acceptedAt?.toMillis();
      });
      setTeamMembers(members);
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  }

  function promptCancelInvitation(invitationId) {
    setSelectedInvitationId(invitationId);
    setShowCancelDialog(true);
  }

  async function handleCancelInvitation() {
    if (!selectedInvitationId) return;

    try {
      const invitationRef = doc(db, 'teamInvitations', selectedInvitationId);
      await deleteDoc(invitationRef);
      await fetchTeamData();
    } catch (error) {
      console.error('Error canceling invitation:', error);
      alert(t('team.dialogs.cancelInvitationError'));
    } finally {
      setShowCancelDialog(false);
      setSelectedInvitationId(null);
    }
  }

  function promptRemoveMember(memberId) {
    setSelectedMemberId(memberId);
    setShowRemoveDialog(true);
  }

  async function handleRemoveMember() {
    if (!selectedMemberId) return;

    try {
      // Update invitation status to removed
      const invitationRef = doc(db, 'teamInvitations', selectedMemberId);
      await updateDoc(invitationRef, {
        status: 'removed',
        removedAt: new Date()
      });
      await fetchTeamData();
    } catch (error) {
      console.error('Error removing member:', error);
      alert(t('team.dialogs.removeMemberError'));
    } finally {
      setShowRemoveDialog(false);
      setSelectedMemberId(null);
    }
  }

  function getRoleBadgeColor(role) {
    switch (role) {
      case TeamRole.OWNER:
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
      case TeamRole.ADMIN:
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case TeamRole.MEMBER:
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      default:
        return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300';
    }
  }

  return (
    <AppShell title={t('team.title')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{t('team.title')}</h2>
            <p className="mt-2 text-gray-600 dark:text-slate-400">{t('team.subtitle')}</p>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium transition-opacity hover:opacity-90"
          >
            {t('team.inviteMember')}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Team Owner Card */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('team.teamOwner')}</h3>
              <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-purple-200 dark:bg-purple-700 flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {userProfile?.displayName || currentUser?.displayName || currentUser?.email} (Tu)
                    </p>
                    <p className="text-sm text-gray-500 dark:text-slate-400">{currentUser?.email}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getRoleBadgeColor(TeamRole.OWNER)}`}>
                  {t('team.owner')}
                </span>
              </div>
            </div>

            {/* Team Members */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('team.teamMembers')} ({teamMembers.length})
                </h3>
              </div>
              <div className="p-6">
                {teamMembers.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-slate-400 py-8">
                    {t('team.noMembers')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-600 flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{member.email}</p>
                            <p className="text-sm text-gray-500 dark:text-slate-400">
                              {t('team.joined')} {member.acceptedAt?.toDate().toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getRoleBadgeColor(member.role)}`}>
                            {member.role === TeamRole.ADMIN ? t('team.admin') : t('team.member')}
                          </span>
                          <button
                            onClick={() => promptRemoveMember(member.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium transition-colors"
                          >
                            {t('team.remove')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Pending Invitations */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('team.pendingInvitations')} ({pendingInvitations.length})
                </h3>
              </div>
              <div className="p-6">
                {pendingInvitations.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-slate-400 py-8">
                    {t('team.noPendingInvitations')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {pendingInvitations.map((invitation) => (
                      <div key={invitation.id} className="flex items-center justify-between p-4 border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-yellow-200 dark:bg-yellow-700 flex items-center justify-center">
                            <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{invitation.email}</p>
                            <p className="text-sm text-gray-500 dark:text-slate-400">
                              {t('team.invited')} {invitation.createdAt?.toDate().toLocaleDateString()} •
                              {t('team.expires')} {invitation.expiresAt?.toDate().toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getRoleBadgeColor(invitation.role)}`}>
                            {invitation.role === TeamRole.ADMIN ? t('team.admin') : t('team.member')}
                          </span>
                          <button
                            onClick={() => promptCancelInvitation(invitation.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium transition-colors"
                          >
                            {t('team.cancel')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Invite Team Modal */}
      <InviteTeamModal
        isOpen={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          fetchTeamData(); // Refresh data after closing modal
        }}
        onInvitationCreated={fetchTeamData}
        existingEmails={[...teamMembers.map(m => m.email), ...pendingInvitations.map(i => i.email)]}
      />

      {/* Cancel Invitation Confirm Dialog */}
      <ConfirmDialog
        isOpen={showCancelDialog}
        onClose={() => {
          setShowCancelDialog(false);
          setSelectedInvitationId(null);
        }}
        onConfirm={handleCancelInvitation}
        title={t('team.dialogs.cancelInvitationTitle')}
        message={t('team.dialogs.cancelInvitationMessage')}
        confirmText={t('team.dialogs.cancelInvitationConfirm')}
        cancelText={t('team.dialogs.cancelInvitationCancel')}
        type="danger"
      />

      {/* Remove Member Confirm Dialog */}
      <ConfirmDialog
        isOpen={showRemoveDialog}
        onClose={() => {
          setShowRemoveDialog(false);
          setSelectedMemberId(null);
        }}
        onConfirm={handleRemoveMember}
        title={t('team.dialogs.removeMemberTitle')}
        message={t('team.dialogs.removeMemberMessage')}
        confirmText={t('team.dialogs.removeMemberConfirm')}
        cancelText={t('team.dialogs.removeMemberCancel')}
        type="danger"
      />
      </div>
    </AppShell>
  );
}
