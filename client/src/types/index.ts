// Order related types
export const OrderStatus = {
  PENDING_CONFIRMATION: 'pending_confirmation',
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

export const ProductType = {
  MUGS: 'mugs',
  T_SHIRTS: 't-shirts',
  HOODIES: 'hoodies',
  BAGS: 'bags',
  CAPS: 'caps',
  OTHER: 'other'
};

// Team related types
export const TeamRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member'
};

export const InvitationStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired'
};

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
  createdAt?: any;
  updatedAt?: any;
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
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

// Department related types
export interface Department {
  id?: string;
  name: string;
  managerId: string; // Team member responsible for managing this department
  managerName?: string; // For display purposes
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}
