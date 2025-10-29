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
