# Serigrafie Brasov - Order Tracking Portal

A modern React application for tracking printing orders with Firebase backend and email-based team invitations.

## Features

### 🎨 Design
- **Color Theme**: Based on serigrafiebrasov.ro
  - Primary: Black (#1a1a1a), White (#ffffff)
  - Accent: Vivid Cyan (#0693e3), Vivid Red (#cf2e2e)
  - Typography: Segoe UI (matching the main website)
  - Clean, professional, modern interface

### 🔐 Authentication
- **Login Page** (`/login`)
  - Email/password authentication
  - Google Sign-In integration
  - No public signup (invite-only system)
  - Firebase Authentication

### 📦 Order Management
- **Dashboard** (`/dashboard`)
  - **Statistics Cards**: Total orders, pending, in progress, and completed counts
  - **Advanced Filtering**:
    - Search by order ID, product type, or description
    - Filter by status (all, pending, in progress, completed, cancelled)
    - Filter by product type (mugs, t-shirts, hoodies, bags, caps, other)
  - **Sorting Options**:
    - By date (newest/oldest)
    - By quantity (high to low / low to high)
    - By status
  - **Order Details Modal**:
    - View full order information
    - Update order status
    - Post comments/updates on orders
    - View update history with timestamps
    - Team members can collaborate on orders
  - Quick order placement button
  - Team invitation button (UI placeholder)

- **Place Order** (`/place-order`)
  - Product type selection (mugs, t-shirts, hoodies, bags, caps, other)
  - Quantity input
  - Detailed description field
  - Design file URL upload
  - Preferred deadline
  - Contact phone
  - Additional notes
  - Stores orders in Firestore

### 👥 Team Invitations (Email-based)
- **Accept Invitation** (`/accept-invitation/:invitationId`)
  - Email-based invitation system (similar to CreatorFlow)
  - Google Sign-In for accepting invites
  - Email validation
  - Expiration handling (7 days)
  - Status tracking (pending, accepted, declined)

## Tech Stack

- **Frontend**: React 19.2 + Vite 7.1
- **Routing**: React Router DOM 7.9
- **Backend**: Firebase
  - Authentication (Email/Password + Google)
  - Firestore (Database)
  - Cloud Functions (for email sending)
  - Analytics

## Project Structure

```
client/
├── src/
│   ├── components/
│   │   └── PrivateRoute.jsx      # Protected route wrapper
│   ├── contexts/
│   │   └── AuthContext.jsx        # Authentication context
│   ├── pages/
│   │   ├── Login.jsx              # Login page
│   │   ├── Dashboard.jsx          # Main dashboard
│   │   ├── PlaceOrder.jsx         # Order placement form
│   │   └── AcceptInvitation.jsx   # Team invitation acceptance
│   ├── services/
│   │   └── emailService.js        # Email/invitation utilities
│   ├── types/
│   │   └── index.js               # Type definitions
│   ├── firebase.js                 # Firebase configuration
│   ├── App.jsx                    # Main app with routing
│   ├── App.css                    # Component styles
│   └── index.css                  # Global styles + color theme
├── index.html
├── package.json
└── vite.config.js
```

## Getting Started

### Prerequisites
- Node.js v20.19+ or v22.12+
- Firebase project with Firestore enabled

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Open http://localhost:5173

## Firebase Setup

### Firestore Collections

#### `orders`
```javascript
{
  userId: string,
  userEmail: string,
  userName: string,
  productType: string,      // 'mugs' | 't-shirts' | 'hoodies' | 'bags' | 'caps' | 'other'
  quantity: number,
  description: string,
  designFile: string,
  deadline: string,
  contactPhone: string,
  notes: string,
  status: string,           // 'pending' | 'in_progress' | 'completed' | 'cancelled'
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `teamInvitations`
```javascript
{
  email: string,
  role: string,             // 'owner' | 'admin' | 'member'
  invitedBy: string,
  invitedByName: string,
  invitedByEmail: string,
  teamOwnerId: string,
  createdAt: Timestamp,
  expiresAt: Timestamp,
  status: string,           // 'pending' | 'accepted' | 'declined' | 'expired'
  acceptedAt?: Timestamp,
  acceptedBy?: string,
  declinedAt?: Timestamp,
  declinedBy?: string
}
```

#### `orderUpdates`
```javascript
{
  orderId: string,          // Reference to orders collection
  userId: string,
  userName: string,
  userEmail: string,
  text: string,             // The update/comment text
  isSystem: boolean,        // true for automated status change updates
  createdAt: Timestamp
}
```

### Authentication Rules
Since signup is disabled, users must be:
1. Manually created in Firebase Console, OR
2. Invited via the email invitation system

## TODO / Future Enhancements

- [ ] Implement the "Invite Team" modal in Dashboard
- [ ] Create Team Management page
- [ ] Add Firebase Cloud Function for sending invitation emails
- [ ] Add order status update functionality (for admins)
- [ ] Add order details view
- [ ] Add file upload for designs (Firebase Storage)
- [ ] Add notifications system
- [ ] Add admin panel for managing all orders
- [ ] Add search and filter for orders
- [ ] Add export functionality (PDF/CSV)

## Color Theme Variables

```css
--primary-black: #1a1a1a
--primary-white: #ffffff
--cyan-gray: #abb8c3
--vivid-red: #cf2e2e
--vivid-cyan: #0693e3
--bg-light: #f9fafb
--bg-dark: #242424
--text-primary: #1f2937
--text-secondary: #6b7280
--border-color: #e5e7eb
```

## Notes

- The app uses Firebase v12.4.0
- The invite system is modeled after the CreatorFlow project
- Email sending requires Firebase Cloud Functions setup (see functions/src/sendTeamInvitationEmail.ts in CreatorFlow)
- No dark mode toggle implemented (system preference only)
