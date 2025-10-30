# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Serigrafie Brasov Order Management System** - A custom printing order tracking portal built with React + Firebase. This is an invite-only team collaboration platform for managing custom printing orders (mugs, t-shirts, hoodies, bags, caps, etc.).

**Key Technologies:**
- Frontend: React 19.2 + TypeScript + Vite 7.1 + TailwindCSS 4.0
- Backend: Firebase (Auth, Firestore, Functions, Storage, Analytics)
- Email: Firebase Cloud Functions with Nodemailer
- Features: i18n (Romanian/English), PDF invoice generation, file uploads, real-time updates

## Development Commands

### Client (React App)
```bash
cd client
npm install              # Install dependencies
npm run dev              # Start dev server at http://localhost:5173
npm run build            # Build for production (outputs to client/dist)
npm run preview          # Preview production build
```

### Functions (Firebase Cloud Functions)
```bash
cd functions
npm install              # Install dependencies
npm run build            # Compile TypeScript to JavaScript
npm run serve            # Run local emulator
firebase deploy --only functions  # Deploy to Firebase
firebase functions:log   # View function logs
```

### Email Configuration (Google Secret Manager)

The Cloud Function uses Google Secret Manager for email credentials. Set the secrets using:

```bash
# Create secrets in Google Secret Manager (replace with actual values)
echo -n "your-email@gmail.com" | gcloud secrets create EMAIL_USER --data-file=-
echo -n "your-app-password" | gcloud secrets create EMAIL_PASS --data-file=-

# Grant access to Cloud Functions
gcloud secrets add-iam-policy-binding EMAIL_USER \
  --member="serviceAccount:serigrafie-brasov@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding EMAIL_PASS \
  --member="serviceAccount:serigrafie-brasov@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**Note:** For Gmail, generate an app password at https://myaccount.google.com/apppasswords

**Important:** Never commit actual credentials to the repository!

### Firebase Deployment
```bash
# Deploy hosting (client app)
firebase deploy --only hosting

# Deploy everything
firebase deploy
```

## Architecture

### Monorepo Structure

```
serigrafie-brasov/
├── client/              # React frontend (TypeScript)
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── contexts/    # React contexts (AuthContext)
│   │   ├── pages/       # Route pages (Dashboard, PlaceOrder, etc.)
│   │   ├── services/    # Business logic layer
│   │   ├── types/       # TypeScript type definitions
│   │   └── i18n/        # Internationalization
│   └── dist/            # Build output (ignored)
├── functions/           # Firebase Cloud Functions (TypeScript)
│   ├── src/
│   │   ├── index.ts                      # Function exports
│   │   └── sendTeamInvitationEmail.ts    # Email sender
│   └── lib/             # Compiled output (ignored)
└── firebase.json        # Firebase config (hosting points to client/dist)
```

### Key Architectural Patterns

**1. Service Layer Pattern**
All Firebase interactions are abstracted into service files:
- `storageService.ts` - File upload/delete operations
- `emailService.ts` - Cloud Function invocations for emails
- `invoiceService.ts` - PDF generation with jsPDF
- `notificationService.tsx` - Toast notifications

**2. Context-Based State Management**
- `AuthContext.tsx` - Global authentication state, user session
- Provides `currentUser`, `loading`, `login()`, `logout()`, `signup()`

**3. Firestore Collection Architecture**

**Collections:**
- `orders` - Main order documents
  - Sub-collection: `orderUpdates` - Comments/status changes per order
- `teamInvitations` - Email-based invitation system
- `users` - User profile data (extended from Firebase Auth)

**Critical Relationships:**
- Orders are linked to `userId` (owner)
- Team members can see orders from their team owner via `teamOwnerId` field
- Order updates reference parent order via `orderId`

**4. Type System**
Centralized in `types/index.ts`:
- `OrderStatus` - pending_confirmation, pending, in_progress, completed, cancelled
- `ProductType` - mugs, t-shirts, hoodies, bags, caps, other
- `TeamRole` - owner, admin, member
- `InvitationStatus` - pending, accepted, declined, expired

### Firebase Security Model

**Authentication Flow:**
1. No public signup - invite-only system
2. Login via Email/Password or Google
3. Team invitations sent via Cloud Function email
4. Invitation acceptance creates Firebase Auth user + Firestore profile

**Data Access Patterns:**
- Users see their own orders + team owner's orders
- Query pattern: `where('userId', 'in', [currentUser.uid, teamOwnerId])`
- File uploads scoped to `userId` for isolation

### File Upload System

**Storage Buckets:**
- `designs/` - Order design files from PlaceOrder form
- `updates/` - Attachments on order updates/comments
- Path format: `{folder}/{userId}/{timestamp}_{filename}`

**Upload Flow:**
1. Client selects file(s)
2. `uploadFile()` or `uploadMultipleFiles()` from `storageService.ts`
3. Returns `{url, path, name, size, type}`
4. Store metadata in Firestore document

### Email Invitation System

**Complete Flow:**
1. User clicks "Invite Team" in Dashboard
2. `InviteTeamModal` component opens
3. Client calls `sendTeamInvitation()` from `emailService.ts`
4. Creates Firestore `teamInvitations` document
5. Calls Cloud Function `sendTeamInvitationEmail`
6. Nodemailer sends HTML email with accept link
7. Recipient clicks link → `AcceptInvitation` page
8. Google Sign-In → Validates invitation → Creates user account
9. Updates invitation status to 'accepted'

**Important:** Invitations expire after 7 days (`expiresAt` timestamp)

### Internationalization (i18n)

**Setup:**
- `i18n.ts` - react-i18next configuration
- `i18n/locales/ro.json` - Romanian translations
- `i18n/locales/en.json` - English translations

**Usage in Components:**
```typescript
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
return <h1>{t('dashboard.title')}</h1>;
```

**Language Switching:**
- Stored in localStorage: `i18nextLng`
- Change via `i18n.changeLanguage('ro' | 'en')`

## Design System

**Brand Colors (from serigrafiebrasov.ro):**
- Primary Black: `#1a1a1a`
- Vivid Cyan (accent): `#0693e3`
- Vivid Red (accent): `#cf2e2e`
- Cyan Gray: `#abb8c3`

**Typography:**
- Font Family: Segoe UI (system font, matches main website)

**UI Library:**
- TailwindCSS 4.0 for styling
- HeadlessUI for accessible components (modals, dialogs)
- Heroicons for icons

## Common Development Patterns

### Adding a New Order Status

1. Update `types/index.ts`:
```typescript
export const OrderStatus = {
  // ... existing
  NEW_STATUS: 'new_status'
};
```

2. Add translation keys in `i18n/locales/ro.json` and `en.json`

3. Update Dashboard filters and status display logic

### Creating a New Firebase Cloud Function

1. Create function file in `functions/src/myFunction.ts`
2. Export in `functions/src/index.ts`:
```typescript
export * from './myFunction';
```
3. Build: `cd functions && npm run build`
4. Deploy: `firebase deploy --only functions:myFunction`

### Adding File Upload to a Feature

```typescript
import { uploadFile, uploadMultipleFiles } from '../services/storageService';

// Single file
const result = await uploadFile(file, 'folder', currentUser.uid);
// result: { url, path, name, size, type }

// Multiple files
const results = await uploadMultipleFiles(files, 'folder', currentUser.uid);

// Store in Firestore
await updateDoc(docRef, {
  attachments: results
});
```

### Querying Orders with Team Access

```typescript
import { collection, query, where, getDocs } from 'firebase/firestore';

// Get team owner ID first (from user profile or teamInvitation)
const userIds = [currentUser.uid];
if (teamOwnerId) userIds.push(teamOwnerId);

const ordersRef = collection(db, 'orders');
const q = query(ordersRef, where('userId', 'in', userIds));
const snapshot = await getDocs(q);
```

## Known Issues & Gotchas

1. **File Paths:** This is a Windows development environment (`E:\Projects\...`). Use forward slashes in Firebase Storage paths.

2. **Team Member Queries:** Firestore `in` queries are limited to 10 items. If a team has >9 members, the query will fail. Consider alternative architecture for large teams.

3. **Invitation Expiry:** No automatic cleanup of expired invitations. Consider adding a Cloud Function with scheduled cleanup.

4. **Email Configuration:** Gmail app passwords required (not regular password). Generate at https://myaccount.google.com/apppasswords

5. **Build Output:** Firebase Hosting serves from `client/dist`. Always run `npm run build` in client before deploying hosting.

6. **TypeScript in Functions:** Must compile TS to JS before deployment. The `npm run deploy` script in functions does NOT auto-build. Run `npm run build` first.

## Testing Locally

**Client Only:**
```bash
cd client && npm run dev
```

**With Firebase Emulators (Functions, Firestore, Auth):**
```bash
firebase emulators:start
```
Then configure client to use emulator endpoints (see Firebase docs).

## E-Factura Integration (Future)

Romania requires E-Factura for B2B invoicing. See `IMPLEMENTATION_GUIDE.md` for integration options:
- Direct ANAF API (complex, requires digital certificate)
- Third-party services: SmartBill, FGO, Oblio (recommended)

Invoice generation is implemented (`invoiceService.ts`) but E-Factura submission is not yet integrated.

## Security Notes

- Firebase config with API keys is in `firebase.ts` - This is safe for client-side (protected by Firebase Security Rules)
- Sensitive credentials (email password) stored in Firebase Functions config, never in client code
- File uploads are scoped per user to prevent unauthorized access
- Firestore Security Rules should be configured to enforce team-based access (not in repo)

## Deployment Checklist

Before production deployment:
1. Configure Firebase Security Rules for Firestore and Storage
2. Test email sending in production environment
3. Set up Firebase project budget alerts
4. Configure custom domain in Firebase Hosting (if applicable)
5. Enable Firebase Analytics for monitoring
6. Review and implement E-Factura integration requirements
7. GDPR compliance: Add Privacy Policy and Terms of Service pages

## Firebase Project Info

- Project ID: `serigrafie-brasov`
- Hosting Site: `serigrafie-brasov`
- Region: Default (us-central1 for functions)
- Node.js Engine: 18 (for Cloud Functions)
