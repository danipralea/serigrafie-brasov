# Serigrafie Brasov - Complete Implementation Guide

## 🎉 Completed Features

### ✅ Core Functionality
- [x] Firebase Authentication (Email/Password + Google)
- [x] Firebase Firestore Database
- [x] Firebase Storage for file uploads
- [x] Login page with authentication
- [x] Dashboard with order tracking
- [x] Advanced filtering and sorting
- [x] Order placement form
- [x] Order details modal with status updates
- [x] Comment/update system on orders
- [x] Team invitation system (email-based)
- [x] Team management page
- [x] Accept invitation page
- [x] File upload service
- [x] I18n setup (Romanian & English translations)

### ✅ Design & UX
- [x] Color theme from serigrafiebrasov.ro
- [x] Responsive design
- [x] Professional, modern UI
- [x] Statistics cards
- [x] Modal interactions

## 🚧 Features to Complete

### 1. File Attachments in Status Updates

**Current State**: Order updates support text only
**Required**: Add file upload capability to updates

**Implementation Steps**:

1. Update `Dashboard.jsx` - Add file upload to the update form:
```jsx
const [updateFiles, setUpdateFiles] = useState([]);

// In the update form section:
<input
  type="file"
  multiple
  onChange={(e) => setUpdateFiles(Array.from(e.target.files))}
  className="mb-2"
/>
```

2. Update the `postUpdate` function:
```javascript
import { uploadMultipleFiles } from '../services/storageService';

async function postUpdate() {
  // ... existing code ...

  // Upload files if any
  let attachments = [];
  if (updateFiles.length > 0) {
    attachments = await uploadMultipleFiles(updateFiles, 'updates', currentUser.uid);
  }

  await addDoc(updatesRef, {
    // ... existing fields ...
    attachments: attachments
  });
}
```

3. Display attachments in updates list:
```jsx
{update.attachments && update.attachments.map((file, idx) => (
  <a key={idx} href={file.url} target="_blank" className="text-blue-600">
    📎 {file.name}
  </a>
))}
```

### 2. Complete I18n Integration

**Files Created**:
- `src/i18n/config.js`
- `src/i18n/locales/ro.json`
- `src/i18n/locales/en.json`

**Integration Steps**:

1. Import i18n in `main.jsx`:
```javascript
import './i18n/config';
```

2. Add language switcher component:
```jsx
// src/components/LanguageSwitcher.jsx
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <select
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className="px-2 py-1 border rounded"
    >
      <option value="ro">RO</option>
      <option value="en">EN</option>
    </select>
  );
}
```

3. Use translations in components:
```javascript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('dashboard.title')}</h1>;
}
```

### 3. Toast Notifications

**Required Package**: `react-hot-toast` (already similar pattern exists)

**Installation**:
```bash
cd client && npm install react-hot-toast
```

**Implementation**:

1. Add Toaster to `App.jsx`:
```jsx
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <>
      <Toaster position="top-right" />
      {/* ... routes ... */}
    </>
  );
}
```

2. Use in components:
```javascript
import toast from 'react-hot-toast';

// Success
toast.success('Comandă creată cu succes!');

// Error
toast.error('Eroare la crearea comenzii');

// Loading
const toastId = toast.loading('Se creează comanda...');
// ... after operation
toast.success('Comandă creată!', { id: toastId });
```

### 4. Invoice Generation System

**Required Package**: `jspdf` and `jspdf-autotable`

**Installation**:
```bash
cd client && npm install jspdf jspdf-autotable
```

**Implementation**:

Create `src/services/invoiceService.js`:
```javascript
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export function generateInvoice(order, companyInfo, clientInfo) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.text('FACTURĂ', 105, 20, { align: 'center' });

  // Company info
  doc.setFontSize(10);
  doc.text(`De la: ${companyInfo.name}`, 20, 40);
  doc.text(`${companyInfo.address}`, 20, 45);
  doc.text(`CUI: ${companyInfo.cui}`, 20, 50);

  // Client info
  doc.text(`Către: ${clientInfo.name}`, 20, 65);
  doc.text(`${clientInfo.email}`, 20, 70);
  if (clientInfo.phone) doc.text(`Tel: ${clientInfo.phone}`, 20, 75);

  // Invoice details
  doc.text(`Număr factură: ${order.invoiceNumber || order.id.substring(0, 8).toUpperCase()}`, 120, 65);
  doc.text(`Dată: ${new Date().toLocaleDateString('ro-RO')}`, 120, 70);

  // Items table
  doc.autoTable({
    startY: 90,
    head: [['Descriere', 'Cantitate', 'Preț unitar', 'Total']],
    body: [
      [
        order.description,
        order.quantity,
        order.unitPrice || 0,
        order.quantity * (order.unitPrice || 0)
      ]
    ]
  });

  // Totals
  const finalY = doc.lastAutoTable.finalY + 10;
  const subtotal = order.quantity * (order.unitPrice || 0);
  const vat = subtotal * 0.19; // 19% VAT in Romania
  const total = subtotal + vat;

  doc.text(`Subtotal: ${subtotal.toFixed(2)} LEI`, 150, finalY);
  doc.text(`TVA (19%): ${vat.toFixed(2)} LEI`, 150, finalY + 5);
  doc.setFontSize(12);
  doc.text(`TOTAL: ${total.toFixed(2)} LEI`, 150, finalY + 15);

  return doc;
}

export function downloadInvoice(order, companyInfo, clientInfo) {
  const doc = generateInvoice(order, companyInfo, clientInfo);
  doc.save(`factura-${order.id.substring(0, 8)}.pdf`);
}
```

**Add to Order Details Modal**:
```jsx
<button
  onClick={() => {
    const companyInfo = {
      name: 'Serigrafie Brasov SRL',
      address: 'Str. Exemplu, Nr. 1, Brașov',
      cui: 'RO12345678'
    };
    const clientInfo = {
      name: selectedOrder.userName,
      email: selectedOrder.userEmail,
      phone: selectedOrder.contactPhone
    };
    downloadInvoice(selectedOrder, companyInfo, clientInfo);
  }}
  className="px-4 py-2 bg-green-600 text-white rounded"
>
  Generează Factură
</button>
```

### 5. E-Factura Integration

**What is E-Factura?**
E-Factura is the Romanian government's mandatory electronic invoicing system (ANAF - Agenția Națională de Administrare Fiscală).

**Integration Options**:

#### Option 1: ANAF API Direct Integration (Complex)
Requires:
- Certificate digital (digital certificate) from a Certification Authority
- OAuth 2.0 authentication
- XML invoice format (UBL or CII)
- SPV (Spatial Producator Vanzator) code

**Steps**:
1. Register on https://www.anaf.ro/
2. Get digital certificate
3. Register application for API access
4. Implement XML generation
5. Implement API calls

#### Option 2: Third-Party Service (Recommended)
Use services like:
- **SmartBill** (https://www.smartbill.ro/)
- **FGO** (https://www.factureonline.ro/)
- **Oblio** (https://www.oblio.eu/)

These services handle E-Factura integration and provide simple APIs.

**SmartBill Integration Example**:
```javascript
// src/services/eFacuraService.js
import axios from 'axios';

const SMARTBILL_API = 'https://ws.smartbill.ro/SBORO/api';
const API_TOKEN = process.env.SMARTBILL_TOKEN; // Store in env

export async function sendToEFacura(invoice) {
  try {
    // Create invoice in SmartBill
    const response = await axios.post(
      `${SMARTBILL_API}/invoice`,
      {
        companyVatCode: 'RO12345678', // Your CUI
        client: {
          name: invoice.clientName,
          code: invoice.clientCode,
          email: invoice.clientEmail,
          vatCode: invoice.clientVAT // if B2B
        },
        products: [{
          name: invoice.productName,
          code: invoice.productCode,
          quantity: invoice.quantity,
          price: invoice.unitPrice,
          vatPercentage: 19
        }]
      },
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      invoiceNumber: response.data.number,
      eFacuraId: response.data.eFacuraId
    };
  } catch (error) {
    console.error('E-Factura error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

**Configuration File**:
Create `e-factura-config.md`:
```markdown
# E-Factura Configuration

## Required Information
1. Company CUI (Cod Unic de Înregistrare)
2. Company Name
3. Company Address
4. VAT Registration (if applicable)

## Setup Steps
1. Create account on chosen platform (SmartBill/FGO/Oblio)
2. Get API credentials
3. Add to Firebase Functions config:
   ```
   firebase functions:config:set efactura.api_key="your-key"
   firebase functions:config:set efactura.api_url="api-url"
   ```
4. Test in sandbox environment first

## Invoice Requirements
- Invoice number (unique, sequential)
- Date of issue
- Seller information (complete)
- Buyer information (at least name and CUI for B2B)
- Products/Services with VAT
- Total amounts

## Legal Notes
- Mandatory for B2B transactions > 100 LEI (RON)
- Deadline: 5 days from invoice issue
- Keep digital copy for 10 years
```

### 6. Admin Panel

Create `src/pages/Admin.jsx`:
```jsx
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';

export default function Admin() {
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllOrders();
  }, []);

  async function fetchAllOrders() {
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllOrders(orders);
    } catch (error) {
      console.error('Error fetching all orders:', error);
    } finally {
      setLoading(false);
    }
  }

  // ... render similar to Dashboard but for all users
}
```

### 7. Update Routing

Add to `App.jsx`:
```jsx
import Admin from './pages/Admin';
import TeamManagement from './pages/TeamManagement';

// Add routes:
<Route path="/team" element={<PrivateRoute><TeamManagement /></PrivateRoute>} />
<Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
```

## 📧 Firebase Functions Email Configuration

The email credentials you provided:
- **Email**: praleadanut@gmail.com
- **App Password**: rgbc fqgf bnnh gech

**Setup**:
```bash
cd functions
npm install
firebase functions:config:set email.user="praleadanut@gmail.com"
firebase functions:config:set email.pass="rgbc fqgf bnnh gech"
firebase deploy --only functions
```

## 🗄️ Firebase Collections Structure

### Complete Schema

#### `orders`
```javascript
{
  id: string (auto-generated),
  userId: string,
  userEmail: string,
  userName: string,
  productType: string,
  quantity: number,
  description: string,
  designFile: string (URL),
  designFiles: [{url, path, name, size}], // Array of uploaded files
  deadline: string,
  contactPhone: string,
  notes: string,
  status: string,
  unitPrice: number, // For invoicing
  invoiceNumber: string,
  invoiceGenerated: boolean,
  eFacuraId: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `orderUpdates`
```javascript
{
  id: string,
  orderId: string,
  userId: string,
  userName: string,
  userEmail: string,
  text: string,
  attachments: [{url, path, name, size, type}], // NEW
  isSystem: boolean,
  createdAt: Timestamp
}
```

#### `teamInvitations`
```javascript
{
  id: string,
  email: string,
  role: string,
  invitedBy: string,
  invitedByName: string,
  invitedByEmail: string,
  teamOwnerId: string,
  status: string,
  createdAt: Timestamp,
  expiresAt: Timestamp,
  acceptedAt: Timestamp,
  acceptedBy: string,
  declinedAt: Timestamp,
  declinedBy: string
}
```

## 🚀 Deployment Checklist

### Firebase Setup
- [ ] Enable Firebase Auth (Email/Password + Google)
- [ ] Create Firestore database
- [ ] Set up Storage with rules
- [ ] Deploy Cloud Functions
- [ ] Configure email credentials
- [ ] Set up E-Factura integration (if using third-party)

### Production Readiness
- [ ] Set up Firebase security rules
- [ ] Configure environment variables
- [ ] Set up backup strategy
- [ ] Configure monitoring/logging
- [ ] Set up error tracking (Sentry)
- [ ] Performance optimization
- [ ] SEO optimization

### Legal Requirements (Romania)
- [ ] GDPR compliance
- [ ] Terms & Conditions
- [ ] Privacy Policy
- [ ] Cookie consent
- [ ] E-Factura integration
- [ ] Digital signature (if required)

## 📝 Priority Implementation Order

1. **High Priority** (Do First):
   - [x] Complete file attachments in updates
   - [ ] Integrate i18n throughout the app
   - [ ] Add toast notifications
   - [ ] Update routing with Team and Admin pages

2. **Medium Priority**:
   - [ ] Invoice generation
   - [ ] Admin panel completion
   - [ ] Enhanced file upload in Place Order form

3. **Low Priority** (Can be done later):
   - [ ] E-Factura integration (once business is established)
   - [ ] Advanced analytics
   - [ ] Email templates customization

## 🎯 Quick Wins

These can be implemented quickly:

1. **Toast Notifications** - 30 minutes
2. **Language Switcher Component** - 30 minutes
3. **Update Routing** - 15 minutes
4. **File Upload in Updates** - 1 hour

## 💡 Tips & Best Practices

1. **Security**: Never expose API keys in client code
2. **Performance**: Use Firebase indexes for complex queries
3. **Backups**: Regular Firestore backups
4. **Testing**: Test E-Factura in sandbox first
5. **Monitoring**: Set up Firebase Analytics and Performance Monitoring

## 🔗 Useful Resources

- [Firebase Docs](https://firebase.google.com/docs)
- [ANAF E-Factura](https://www.anaf.ro/anaf/internet/ANAF/despre_anaf/strategii_anaf/proiecte_digitalizare/e_factura/)
- [SmartBill API](https://www.smartbill.ro/api/)
- [React i18next](https://react.i18next.com/)
- [jsPDF Documentation](https://github.com/parallax/jsPDF)
