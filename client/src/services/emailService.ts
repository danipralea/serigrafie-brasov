import { getFunctions, httpsCallable } from 'firebase/functions';

export async function sendTeamInvitationEmail(data) {
  try {
    const functions = getFunctions();
    const sendInvitationEmail = httpsCallable(functions, 'sendTeamInvitationEmail');
    await sendInvitationEmail(data);
    return data.invitationLink;
  } catch (error) {
    console.error('Error sending invitation email:', error);

    // In development, if email service is not configured, log the invitation link
    if (error?.code === 'failed-precondition' ||
        error?.message?.includes('Email service is not configured')) {
      console.warn('Email service not configured. Invitation created but email not sent.');
      console.log('Invitation link:', data.invitationLink);
      return data.invitationLink;
    }

    throw error;
  }
}

export function createInvitationLink(invitationId) {
  const baseUrl = window.location.origin;
  return `${baseUrl}/accept-invitation/${invitationId}`;
}
