# Firebase Cloud Functions

## Setup

1. Install dependencies:
```bash
cd functions
npm install
```

2. Configure email credentials:
```bash
firebase functions:config:set email.user="your-email@gmail.com"
firebase functions:config:set email.pass="your-app-password"
```

For Gmail, generate an app password at: https://myaccount.google.com/apppasswords

3. Deploy functions:
```bash
npm run deploy
```

Or deploy a specific function:
```bash
firebase deploy --only functions:sendTeamInvitationEmail
```

## Available Functions

### sendTeamInvitationEmail
Sends team invitation emails with a link to accept the invitation.

**Triggered by**: Client-side call from `client/src/services/emailService.js`

**Parameters**:
- email: Recipient email address
- inviterName: Name of the person sending the invitation
- inviterEmail: Email of the inviter
- role: Team role ('owner', 'admin', 'member')
- invitationLink: Link to accept the invitation

## Local Testing

Run functions locally with the emulator:
```bash
npm run serve
```

## Logs

View function logs:
```bash
npm run logs
```
