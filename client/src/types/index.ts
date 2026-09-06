import { Timestamp } from 'firebase/firestore';

// Order related types
export const OrderStatus = {
  PENDING_CONFIRMATION: 'pending_confirmation',
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  DELIVERED: 'delivered',
  INVOICED: 'invoiced',
  CANCELLED: 'cancelled'
} as const;

export type OrderStatusType = typeof OrderStatus[keyof typeof OrderStatus];

export const ProductType = {
  MUGS: 'mugs',
  T_SHIRTS: 't-shirts',
  HOODIES: 'hoodies',
  BAGS: 'bags',
  CAPS: 'caps',
  OTHER: 'other'
} as const;

export type ProductTypeType = typeof ProductType[keyof typeof ProductType];

// User role types
export const UserRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  USER: 'user'
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

// Legacy: Keep TeamRole for backward compatibility, but use UserRole for new code
export const TeamRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member'
} as const;

export type TeamRoleType = typeof TeamRole[keyof typeof TeamRole];

export const InvitationStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired'
} as const;

export type InvitationStatusType = typeof InvitationStatus[keyof typeof InvitationStatus];

export const AuthProvider = {
  GOOGLE: 'google.com',
  PASSWORD: 'password',
  PHONE: 'phone'
} as const;

export type AuthProviderType = typeof AuthProvider[keyof typeof AuthProvider];

// Supplier related types
export interface ContactPerson {
  name: string;
  email: string;
  phone: string;
}

export interface Supplier {
  id?: string;
  name: string;
  email: string;
  phone: string;
  contactPerson?: ContactPerson;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SupplierOrderItem {
  id: string;
  productType: {
    id: string;
    name: string;
    description?: string;
    isCustom?: boolean;
  } | null;
  quantity: string;
  client: string; // Text input for client name
  description: string; // Text area for description
}

export interface SupplierOrder {
  id?: string;
  supplierId: string;
  supplierName: string;
  items: SupplierOrderItem[];
  status: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

// Department related types
export interface Department {
  id?: string;
  name: string;
  managerId: string; // Team member responsible for managing this department
  managerName?: string; // For display purposes
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

// Invoicing related types
export const InvoiceStatus = {
  /** Working set - orders can still be added and removed, no number yet. */
  DRAFT: 'draft',
  /** Numbered and frozen. */
  ISSUED: 'issued',
  PAID: 'paid',
  CANCELLED: 'cancelled'
} as const;

export type InvoiceStatusType = typeof InvoiceStatus[keyof typeof InvoiceStatus];

export interface InvoiceDoc {
  id?: string;
  /** Allocated when the invoice is issued; drafts have none. */
  number?: string | null;
  series?: string;
  sequence?: number | null;
  status: InvoiceStatusType;

  // Client snapshot
  clientId: string;
  clientName: string;
  clientCompany: string;
  clientCui: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;

  /** Queryable projection of the orders on this invoice. */
  orderIds: string[];
  /** Display data for those orders, so lists need no extra reads. */
  orders: any[];
  /** One line per sub-order. Frozen once the invoice is issued. */
  lines: any[];

  periodStart?: Timestamp | null;
  periodEnd?: Timestamp | null;
  dueDate?: Timestamp | null;

  currency: string;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  notes?: string;

  createdAt?: Timestamp;
  createdBy?: string;
  createdByName?: string;
  updatedAt?: Timestamp;
  issuedAt?: Timestamp | null;
  issuedBy?: string | null;
  issuedByName?: string | null;
  paidAt?: Timestamp | null;
  cancelledAt?: Timestamp | null;
  cancelledBy?: string | null;
}

/** Invoicing settings, stored in a single `settings/invoicing` document. */
export interface InvoiceSettings {
  series: string;
  nextSequence: number;
  /** Year the sequence belongs to; it restarts when the year changes. */
  sequenceYear: number;
  vatRate: number;
  currency: string;
  paymentTermDays: number;
}
