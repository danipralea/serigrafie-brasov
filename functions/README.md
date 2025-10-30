# Firebase Cloud Functions

## Setup

1. Install dependencies:
```bash
cd functions
npm install
```

2. Configure email credentials using Google Secret Manager:
```bash
# Create secrets (replace with your actual values)
echo -n "your-email@gmail.com" | gcloud secrets create EMAIL_USER --data-file=-
echo -n "your-app-password" | gcloud secrets create EMAIL_PASS --data-file=-

# Grant access to Cloud Functions service account
gcloud secrets add-iam-policy-binding EMAIL_USER \
  --member="serviceAccount:serigrafie-brasov@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding EMAIL_PASS \
  --member="serviceAccount:serigrafie-brasov@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**Note:** For Gmail, generate an app password at: https://myaccount.google.com/apppasswords

**Or use Google Cloud Console:**
- Go to: https://console.cloud.google.com/security/secret-manager?project=serigrafie-brasov
- Create secrets named `EMAIL_USER` and `EMAIL_PASS`

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
