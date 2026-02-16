import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, hasTeamAccess, hasAdminAccess } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { OrderStatus } from '../types';
import { useDepartments } from '../hooks/useDepartments';
import { downloadInvoice, sendInvoiceToClient } from '../services/invoiceService';
import { uploadFile } from '../services/storageService';
import { showSuccess, showError } from '../services/notificationService';
import ConfirmDialog from './ConfirmDialog';
import { formatDate } from '../utils/dateUtils';

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onOrderUpdated?: () => void;
}

export default function OrderDetailsModal({ isOpen, onClose, order, onOrderUpdated }: OrderDetailsModalProps) {
  const { t } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const [updateText, setUpdateText] = useState('');
  const [postingUpdate, setPostingUpdate] = useState(false);
  const [orderUpdates, setOrderUpdates] = useState<any[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<any>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const attachmentInputRef = useRef<any>(null);
  const updatesEndRef = useRef<any>(null);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [showDeleteUpdateDialog, setShowDeleteUpdateDialog] = useState(false);
  const [selectedUpdateId, setSelectedUpdateId] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(order);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [editSubOrders, setEditSubOrders] = useState<any[]>([]);
  const { departments } = useDepartments();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedOrder(order);
    setIsEditing(false);
  }, [order]);

  useEffect(() => {
    if (isOpen && order) {
      fetchOrderUpdates(order.id);
    }
  }, [isOpen, order]);

  // Auto-scroll to bottom when updates change
  useEffect(() => {
    if (updatesEndRef.current) {
      updatesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [orderUpdates]);

  async function fetchOrderUpdates(orderId: string) {
    try {
      const updatesRef = collection(db, 'orderUpdates');
      const q = query(updatesRef, where('orderId', '==', orderId));
      const snapshot = await getDocs(q);
      const updates = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      updates.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeA - timeB;
      });

      setOrderUpdates(updates);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching order updates:', error);
      }
      setOrderUpdates([]);
    }
  }

  function getInitials(name: string, email: string) {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'U';
  }

  async function postUpdate() {
    if ((!updateText.trim() && !attachmentFile) || !selectedOrder) return;

    try {
      setPostingUpdate(true);

      let attachmentURL = null;
      let attachmentName = null;
      let attachmentType = null;

      if (attachmentFile) {
        try {
          setUploadingAttachment(true);
          const result = await uploadFile(attachmentFile, 'updates', currentUser!.uid);
          attachmentURL = result.url;
          attachmentName = result.name;
          attachmentType = result.type;
        } catch (uploadError) {
          if (import.meta.env.DEV) {
            console.error('Error uploading attachment:', uploadError);
          }
          showError(t('dashboard.orderModal.attachmentUploadFailed'));
        } finally {
          setUploadingAttachment(false);
        }
      }

      const updatesRef = collection(db, 'orderUpdates');
      const updateData: any = {
        orderId: selectedOrder.id,
        userId: currentUser!.uid,
        userName: userProfile?.displayName || currentUser!.displayName || currentUser!.email || 'Unknown',
        userEmail: currentUser!.email || '',
        userPhotoURL: userProfile?.photoURL || '',
        isAdminOrTeamMember: hasTeamAccess(userProfile) || false,
        text: updateText.trim() || '',
        createdAt: Timestamp.now()
      };

      if (attachmentURL) {
        updateData.attachmentURL = attachmentURL;
        updateData.attachmentName = attachmentName;
        updateData.attachmentType = attachmentType;
      }

      await addDoc(updatesRef, updateData);
      await fetchOrderUpdates(selectedOrder.id);
      setUpdateText('');
      setAttachmentFile(null);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error posting update:', error);
      }
      showError(`Failed to post update: ${(error as any).message || 'Unknown error'}`);
    } finally {
      setPostingUpdate(false);
      setUploadingAttachment(false);
    }
  }

  async function updateOrderStatus(newStatus: string) {
    if (!selectedOrder) return;

    // Check if trying to complete order
    if (newStatus === OrderStatus.COMPLETED) {
      // Check if all sub-orders are completed
      const incompleteSubOrders = selectedOrder.subOrders.filter((subOrder: any) =>
        subOrder.status !== OrderStatus.COMPLETED
      );

      if (incompleteSubOrders.length > 0) {
        showError(t('order.cannotCompleteOrderWithIncompleteSubOrders'));
        return;
      }
    }

    try {
      const orderRef = doc(db, 'orders', selectedOrder.id);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: Timestamp.now()
      });

      const updatesRef = collection(db, 'orderUpdates');
      await addDoc(updatesRef, {
        orderId: selectedOrder.id,
        userId: currentUser!.uid,
        userName: t('dashboard.orderModal.system'),
        userEmail: currentUser!.email,
        text: `${t('dashboard.orderModal.statusChangedTo')} ${getStatusLabel(newStatus)}`,
        isSystem: true,
        createdAt: Timestamp.now()
      });

      if (selectedOrder.userId && selectedOrder.userId !== currentUser!.uid) {
        const notificationsRef = collection(db, 'notifications');
        await addDoc(notificationsRef, {
          userId: selectedOrder.userId,
          type: 'status_change',
          title: newStatus === OrderStatus.COMPLETED
            ? t('notifications.orderCompleted')
            : t('notifications.orderStatusChanged'),
          message: newStatus === OrderStatus.COMPLETED
            ? t('notifications.orderCompletedMessage', { orderId: selectedOrder.id.substring(0, 8).toUpperCase() })
            : t('notifications.orderStatusChangedMessage', { orderId: selectedOrder.id.substring(0, 8).toUpperCase(), status: getStatusLabel(newStatus) }),
          orderId: selectedOrder.id,
          read: false,
          createdAt: Timestamp.now()
        });
      }

      await fetchOrderUpdates(selectedOrder.id);
      setSelectedOrder({ ...selectedOrder, status: newStatus });
      if (onOrderUpdated) onOrderUpdated();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error updating order status:', error);
      }
      showError('Failed to update order status');
    }
  }

  async function updateSubOrderStatus(subOrderId: string, newStatus: string) {
    if (!selectedOrder) return;

    try {
      const subOrderRef = doc(db, 'orders', selectedOrder.id, 'subOrders', subOrderId);
      await updateDoc(subOrderRef, {
        status: newStatus,
        updatedAt: Timestamp.now()
      });

      // Update local state
      const updatedSubOrders = selectedOrder.subOrders.map((subOrder: any) =>
        subOrder.id === subOrderId ? { ...subOrder, status: newStatus } : subOrder
      );
      setSelectedOrder({ ...selectedOrder, subOrders: updatedSubOrders });

      // Add system update
      const updatesRef = collection(db, 'orderUpdates');
      await addDoc(updatesRef, {
        orderId: selectedOrder.id,
        userId: currentUser!.uid,
        userName: t('dashboard.orderModal.system'),
        userEmail: currentUser!.email,
        text: `${t('order.subOrderStatusChanged')} ${getStatusLabel(newStatus)}`,
        isSystem: true,
        createdAt: Timestamp.now()
      });

      if (newStatus === OrderStatus.COMPLETED && selectedOrder.userId && selectedOrder.userId !== currentUser!.uid) {
        const sub = selectedOrder.subOrders.find((s: any) => s.id === subOrderId);
        const notificationsRef = collection(db, 'notifications');
        await addDoc(notificationsRef, {
          userId: selectedOrder.userId,
          type: 'status_change',
          title: t('notifications.subOrderCompleted'),
          message: t('notifications.subOrderCompletedMessage', {
            orderId: selectedOrder.id.substring(0, 8).toUpperCase(),
            productName: sub?.productTypeName || '',
            department: sub?.departmentName || ''
          }),
          orderId: selectedOrder.id,
          read: false,
          createdAt: Timestamp.now()
        });
      }

      await fetchOrderUpdates(selectedOrder.id);
      if (onOrderUpdated) onOrderUpdated();
      showSuccess(t('order.subOrderStatusUpdated'));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error updating sub-order status:', error);
      }
      showError(t('order.errorUpdatingSubOrderStatus'));
    }
  }

  async function confirmOrder() {
    if (!selectedOrder) return;

    try {
      const orderRef = doc(db, 'orders', selectedOrder.id);
      await updateDoc(orderRef, {
        status: OrderStatus.PENDING,
        confirmedByClient: true,
        confirmedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      const updatesRef = collection(db, 'orderUpdates');
      await addDoc(updatesRef, {
        orderId: selectedOrder.id,
        userId: currentUser!.uid,
        userName: t('dashboard.orderModal.system'),
        userEmail: currentUser!.email,
        text: t('dashboard.orderModal.orderConfirmedByClient'),
        isSystem: true,
        createdAt: Timestamp.now()
      });

      const notificationsRef = collection(db, 'notifications');
      await addDoc(notificationsRef, {
        userId: currentUser!.uid,
        type: 'order_confirmed',
        title: 'Comandă confirmată',
        message: `Comanda #${selectedOrder.id.substring(0, 8).toUpperCase()} a fost confirmată și este gata de procesare`,
        orderId: selectedOrder.id,
        read: false,
        createdAt: Timestamp.now()
      });

      await fetchOrderUpdates(selectedOrder.id);
      setSelectedOrder({ ...selectedOrder, status: OrderStatus.PENDING, confirmedByClient: true });
      if (onOrderUpdated) onOrderUpdated();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error confirming order:', error);
      }
      showError('Eroare la confirmarea comenzii');
    }
  }

  async function deleteOrder() {
    if (!selectedOrder) return;

    try {
      const subOrdersRef = collection(db, 'orders', selectedOrder.id, 'subOrders');
      const subOrdersSnapshot = await getDocs(subOrdersRef);
      await Promise.all(subOrdersSnapshot.docs.map(doc => deleteDoc(doc.ref)));

      const updatesRef = collection(db, 'orderUpdates');
      const updatesQuery = query(updatesRef, where('orderId', '==', selectedOrder.id));
      const updatesSnapshot = await getDocs(updatesQuery);
      await Promise.all(updatesSnapshot.docs.map(doc => deleteDoc(doc.ref)));

      const notificationsRef = collection(db, 'notifications');
      const notificationsQuery = query(notificationsRef, where('orderId', '==', selectedOrder.id));
      const notificationsSnapshot = await getDocs(notificationsQuery);
      await Promise.all(notificationsSnapshot.docs.map(doc => deleteDoc(doc.ref)));

      const orderRef = doc(db, 'orders', selectedOrder.id);
      await deleteDoc(orderRef);

      onClose();
      setShowDeleteDialog(false);
      showSuccess(t('dashboard.orderModal.orderDeleted'));
      if (onOrderUpdated) onOrderUpdated();
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error('Error deleting order:', error);
      }
      let errorMessage = t('dashboard.orderModal.deleteError');
      if (error?.code === 'permission-denied') {
        errorMessage = t('dashboard.orderModal.deletePermissionError');
      }
      showError(errorMessage);
      throw error;
    }
  }

  async function handleDeleteUpdate() {
    if (!selectedUpdateId) return;

    try {
      const updateRef = doc(db, 'orderUpdates', selectedUpdateId);
      await deleteDoc(updateRef);

      if (selectedOrder) {
        await fetchOrderUpdates(selectedOrder.id);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error deleting update:', error);
      }
      showError('Eroare la ștergerea actualizării');
    } finally {
      setShowDeleteUpdateDialog(false);
      setSelectedUpdateId(null);
    }
  }

  function enterEditMode() {
    if (!selectedOrder) return;
    setEditData({
      orderName: selectedOrder.orderName || '',
      clientName: selectedOrder.clientName || '',
      clientCompany: selectedOrder.clientCompany || '',
      clientEmail: selectedOrder.clientEmail || '',
      clientPhone: selectedOrder.clientPhone || '',
    });
    setEditSubOrders(
      (selectedOrder.subOrders || []).map((so: any) => ({
        id: so.id,
        productTypeName: so.productTypeName || so.productType || '',
        positioning: so.positioning || [],
        quantity: so.quantity || 0,
        departmentId: so.departmentId || '',
        departmentName: so.departmentName || '',
        length: so.length || '',
        width: so.width || '',
        cmp: so.cmp || '',
        description: so.description || '',
        notes: so.notes || '',
        deliveryTime: so.deliveryTime || '',
        designFile: so.designFile || '',
      }))
    );
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditData({});
    setEditSubOrders([]);
  }

  async function saveChanges() {
    if (!selectedOrder || !currentUser) return;

    const changes: { field: string; oldValue: string; newValue: string }[] = [];

    const orderFields = [
      { key: 'orderName', label: t('order.orderName') },
      { key: 'clientName', label: t('clients.addModal.name') },
      { key: 'clientCompany', label: t('clients.addModal.company') },
      { key: 'clientEmail', label: t('clients.addModal.email') },
      { key: 'clientPhone', label: t('clients.addModal.phone') },
    ];

    const orderUpdate: any = {};
    for (const f of orderFields) {
      const oldVal = selectedOrder[f.key] || '';
      const newVal = editData[f.key] || '';
      if (oldVal !== newVal) {
        changes.push({ field: f.label, oldValue: oldVal, newValue: newVal });
        orderUpdate[f.key] = newVal;
      }
    }

    const subOrderUpdates: { id: string; data: any }[] = [];
    for (let i = 0; i < editSubOrders.length; i++) {
      const orig = selectedOrder.subOrders[i];
      const edited = editSubOrders[i];
      if (!orig || !edited) continue;

      const subChanges: any = {};
      const subFields = [
        { key: 'productTypeName', label: t('placeOrder.productType') },
        { key: 'positioning', label: t('placeOrder.positioning') },
        { key: 'quantity', label: t('placeOrder.quantity') },
        { key: 'departmentId', label: t('order.department') + ' ID' },
        { key: 'departmentName', label: t('order.department') },
        { key: 'length', label: t('placeOrder.length') },
        { key: 'width', label: t('placeOrder.width') },
        { key: 'cmp', label: t('placeOrder.cmp') },
        { key: 'description', label: t('placeOrder.description') },
        { key: 'notes', label: t('placeOrder.notes') },
        { key: 'deliveryTime', label: t('placeOrder.deliveryTime') },
        { key: 'designFile', label: t('dashboard.orderModal.designFile') },
      ];

      for (const f of subFields) {
        const oldVal = String(orig[f.key] || '');
        const newVal = String(edited[f.key] || '');
        if (oldVal !== newVal) {
          if (f.key !== 'departmentId') {
            changes.push({
              field: `${t('order.subOrderItem')} #${i + 1} ${f.label}`,
              oldValue: oldVal,
              newValue: newVal,
            });
          }
          subChanges[f.key] = f.key === 'quantity' ? Number(edited[f.key]) || 0 : edited[f.key];
        }
      }

      if (Object.keys(subChanges).length > 0) {
        subOrderUpdates.push({ id: orig.id, data: subChanges });
      }
    }

    if (changes.length === 0) {
      showSuccess(t('orderDetails.noChanges'));
      setIsEditing(false);
      return;
    }

    try {
      setSaving(true);

      if (Object.keys(orderUpdate).length > 0) {
        const orderRef = doc(db, 'orders', selectedOrder.id);
        await updateDoc(orderRef, { ...orderUpdate, updatedAt: Timestamp.now() });
      }

      for (const sub of subOrderUpdates) {
        const subRef = doc(db, 'orders', selectedOrder.id, 'subOrders', sub.id);
        await updateDoc(subRef, { ...sub.data, updatedAt: Timestamp.now() });
      }

      const editedByName = userProfile?.displayName || currentUser.displayName || currentUser.email || 'Unknown';
      const changesText = changes
        .map(c => `- ${c.field}: '${c.oldValue}' → '${c.newValue}'`)
        .join('\n');

      const updatesRef = collection(db, 'orderUpdates');
      await addDoc(updatesRef, {
        orderId: selectedOrder.id,
        userId: currentUser.uid,
        userName: t('dashboard.orderModal.system'),
        userEmail: currentUser.email || '',
        text: `${t('orderDetails.editedBy', { name: editedByName })}:\n${changesText}`,
        isSystem: true,
        isAudit: true,
        editedBy: editedByName,
        changes,
        createdAt: Timestamp.now(),
      });

      const updatedOrder = { ...selectedOrder, ...orderUpdate };
      if (subOrderUpdates.length > 0) {
        updatedOrder.subOrders = selectedOrder.subOrders.map((so: any) => {
          const update = subOrderUpdates.find(u => u.id === so.id);
          return update ? { ...so, ...update.data } : so;
        });
      }
      setSelectedOrder(updatedOrder);

      await fetchOrderUpdates(selectedOrder.id);
      setIsEditing(false);
      showSuccess(t('orderDetails.changesSaved'));
      if (onOrderUpdated) onOrderUpdated();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error saving changes:', error);
      }
      showError(t('orderDetails.saveError'));
    } finally {
      setSaving(false);
    }
  }

  function handleDownloadInvoice() {
    if (!selectedOrder) return;

    try {
      downloadInvoice({
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.id.substring(0, 8).toUpperCase(),
        clientName: selectedOrder.userName || selectedOrder.userEmail || 'Client',
        clientEmail: selectedOrder.userEmail || '',
        clientPhone: selectedOrder.contactPhone,
        productType: getProductLabel(selectedOrder.productType),
        quantity: selectedOrder.quantity,
        description: selectedOrder.description,
        createdAt: selectedOrder.createdAt?.toDate(),
        completedAt: selectedOrder.updatedAt?.toDate(),
        amount: undefined
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error downloading invoice:', error);
      }
      showError(t('dashboard.orderModal.downloadInvoiceError'));
    }
  }

  async function handleSendInvoice() {
    if (!selectedOrder) return;

    try {
      setSendingInvoice(true);
      await sendInvoiceToClient({
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.id.substring(0, 8).toUpperCase(),
        clientName: selectedOrder.userName || selectedOrder.userEmail || 'Client',
        clientEmail: selectedOrder.userEmail || '',
        clientPhone: selectedOrder.contactPhone,
        productType: getProductLabel(selectedOrder.productType),
        quantity: selectedOrder.quantity,
        description: selectedOrder.description,
        createdAt: selectedOrder.createdAt?.toDate(),
        completedAt: selectedOrder.updatedAt?.toDate(),
        amount: undefined
      });
      showSuccess(t('dashboard.orderModal.invoiceSent'));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error sending invoice:', error);
      }
      showError(t('dashboard.orderModal.sendInvoiceError'));
    } finally {
      setSendingInvoice(false);
    }
  }

  function getProductLabel(productType: string) {
    const key = productType?.replace(/-/g, '') || '';
    return t(`placeOrder.products.${key}`) || productType;
  }

  function getStatusLabel(status: string) {
    return t(`orderStatus.${status}`) || status;
  }

  function getStatusColor(status: string) {
    const colors: { [key: string]: string } = {
      'pending-confirmation': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
      'pending': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      'in-progress': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
      'completed': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
      'cancelled': 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  }

  if (!isOpen || !selectedOrder) return null;

  return (
    <>
      <div
        data-testid="order-details-modal"
        className="fixed inset-0 bg-slate-900/75 dark:bg-black/80 flex items-center justify-center z-50 p-4 transition-colors"
        onClick={onClose}
      >
        <div
          className="relative bg-white dark:bg-slate-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isEditing ? t('orderDetails.editing') : t('dashboard.orderModal.order')}
                {hasTeamAccess(userProfile) && (
                  <span className="ml-2 text-sm font-mono text-slate-500 dark:text-slate-400">
                    #{selectedOrder.id.substring(0, 8).toUpperCase()}
                  </span>
                )}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('dashboard.orderModal.created')} {(() => {
                  const date = selectedOrder.createdAt?.toDate();
                  if (!date) return '';
                  const dateStr = formatDate(date);
                  const timeStr = date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
                  return `${dateStr} - ${timeStr}`;
                })()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasTeamAccess(userProfile) && !isEditing && (
                <button
                  onClick={enterEditMode}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  title={t('orderDetails.edit')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              {isEditing && (
                <>
                  <button
                    onClick={cancelEdit}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    {t('orderDetails.cancel')}
                  </button>
                  <button
                    onClick={saveChanges}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {saving ? t('orderDetails.saving') : t('orderDetails.save')}
                  </button>
                </>
              )}
              {hasAdminAccess(userProfile) && !isEditing && (
                <button
                  data-testid="delete-order-button"
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-red-600 dark:text-red-500 hover:text-red-800 dark:hover:text-red-400 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  title={t('dashboard.orderModal.deleteOrder')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              <button
                onClick={onClose}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="px-6 py-4">
            {/* Order Name */}
            {(selectedOrder.orderName || isEditing) && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('order.orderName')}</h4>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.orderName || ''}
                    onChange={(e) => setEditData({ ...editData, orderName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                    <p className="text-base font-medium text-gray-900 dark:text-white">{selectedOrder.orderName}</p>
                  </div>
                )}
              </div>
            )}

            {/* Client Information */}
            {(selectedOrder.clientName || isEditing) && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('order.clientInformation')}</h4>
                {isEditing ? (
                  <div className="space-y-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div>
                      <label className="block text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">{t('clients.addModal.name')}</label>
                      <input
                        type="text"
                        value={editData.clientName || ''}
                        onChange={(e) => setEditData({ ...editData, clientName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">{t('clients.addModal.company')}</label>
                      <input
                        type="text"
                        value={editData.clientCompany || ''}
                        onChange={(e) => setEditData({ ...editData, clientCompany: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">{t('clients.addModal.email')}</label>
                      <input
                        type="email"
                        value={editData.clientEmail || ''}
                        onChange={(e) => setEditData({ ...editData, clientEmail: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">{t('clients.addModal.phone')}</label>
                      <input
                        type="text"
                        value={editData.clientPhone || ''}
                        onChange={(e) => setEditData({ ...editData, clientPhone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="text-sm space-y-1">
                      <div className="font-semibold text-blue-900 dark:text-blue-200">{selectedOrder.clientName}</div>
                      {selectedOrder.clientCompany && (
                        <div className="text-blue-800 dark:text-blue-300">{selectedOrder.clientCompany}</div>
                      )}
                      {selectedOrder.clientEmail && (
                        <div className="text-blue-700 dark:text-blue-400">{selectedOrder.clientEmail}</div>
                      )}
                      {selectedOrder.clientPhone && (
                        <div className="text-blue-700 dark:text-blue-400">{selectedOrder.clientPhone}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Order Status */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('dashboard.orderModal.status')}</h4>
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                <span className={`px-3 py-1.5 text-xs font-semibold rounded-full ${getStatusColor(selectedOrder.status)}`}>
                  {getStatusLabel(selectedOrder.status)}
                </span>
              </div>
            </div>

            {/* Sub-Orders */}
            {selectedOrder.subOrders && selectedOrder.subOrders.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('order.orderItems')}</h4>
                <div className="space-y-3">
                  {selectedOrder.subOrders.map((subOrder: any, index: number) => {
                    const editSub = editSubOrders[index];
                    const updateEditSub = (fields: Record<string, any>) => {
                      const updated = [...editSubOrders];
                      updated[index] = { ...updated[index], ...fields };
                      setEditSubOrders(updated);
                    };

                    return (
                      <div key={subOrder.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-slate-600">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="text-sm font-semibold text-gray-900 dark:text-white">
                            {t('order.subOrderItem')} #{index + 1}
                          </h5>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(subOrder.status)}`}>
                            {getStatusLabel(subOrder.status)}
                          </span>
                        </div>

                        {isEditing && editSub ? (
                          <div className="space-y-3 text-sm">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('placeOrder.productType')}</label>
                              <input
                                type="text"
                                value={editSub.productTypeName}
                                onChange={(e) => updateEditSub({ productTypeName: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-600 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('placeOrder.positioning')}</label>
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {(editSub.positioning || []).map((pos: string, pi: number) => (
                                  <span key={pi} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                                    {pos}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = editSub.positioning.filter((_: string, idx: number) => idx !== pi);
                                        updateEditSub({ positioning: updated });
                                      }}
                                      className="text-blue-600 dark:text-blue-300 hover:text-blue-900"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <input
                                type="text"
                                placeholder={t('placeOrder.positioningPlaceholder')}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const val = (e.target as HTMLInputElement).value.trim();
                                    if (val && !(editSub.positioning || []).includes(val)) {
                                      updateEditSub({ positioning: [...(editSub.positioning || []), val] });
                                      (e.target as HTMLInputElement).value = '';
                                    }
                                  }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-600 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('placeOrder.quantity')}</label>
                                <input
                                  type="number"
                                  value={editSub.quantity}
                                  onChange={(e) => updateEditSub({ quantity: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-600 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('order.department')}</label>
                                <select
                                  value={editSub.departmentId}
                                  onChange={(e) => {
                                    const dept = departments.find(d => d.id === e.target.value);
                                    updateEditSub({ departmentId: e.target.value, departmentName: dept?.name || '' });
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-600 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                >
                                  <option value="">{t('order.selectDepartment')}</option>
                                  {departments.map(dept => (
                                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('placeOrder.length')}</label>
                                <input
                                  type="number"
                                  value={editSub.length}
                                  onChange={(e) => updateEditSub({ length: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-600 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('placeOrder.width')}</label>
                                <input
                                  type="number"
                                  value={editSub.width}
                                  onChange={(e) => updateEditSub({ width: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-600 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('placeOrder.squareCm')}</label>
                                <input
                                  type="number"
                                  value={editSub.length && editSub.width ? (parseFloat(editSub.length) * parseFloat(editSub.width)).toFixed(2) : ''}
                                  readOnly
                                  disabled
                                  placeholder="-"
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg text-sm cursor-not-allowed"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('placeOrder.cmp')}</label>
                                <input
                                  type="number"
                                  value={editSub.cmp}
                                  onChange={(e) => updateEditSub({ cmp: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-600 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('placeOrder.deliveryTime')}</label>
                              <input
                                type="datetime-local"
                                value={editSub.deliveryTime}
                                onChange={(e) => updateEditSub({ deliveryTime: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-600 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('placeOrder.description')}</label>
                              <textarea
                                value={editSub.description}
                                onChange={(e) => updateEditSub({ description: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-600 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('placeOrder.notes')}</label>
                              <textarea
                                value={editSub.notes}
                                onChange={(e) => updateEditSub({ notes: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-600 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('dashboard.orderModal.designFile')}</label>
                              <input
                                type="text"
                                value={editSub.designFile}
                                onChange={(e) => updateEditSub({ designFile: e.target.value })}
                                placeholder="https://..."
                                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-600 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-slate-400">{t('placeOrder.productType')}:</span>
                              <span className="text-gray-900 dark:text-white font-medium">{subOrder.productTypeName || subOrder.productType}</span>
                            </div>
                            {subOrder.positioning && subOrder.positioning.length > 0 && (
                              <div className="flex justify-between items-start">
                                <span className="text-gray-600 dark:text-slate-400">{t('placeOrder.positioning')}:</span>
                                <div className="flex flex-wrap gap-1 justify-end">
                                  {subOrder.positioning.map((pos: string, pi: number) => (
                                    <span key={pi} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                                      {pos}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-slate-400">{t('placeOrder.quantity')}:</span>
                              <span className="text-gray-900 dark:text-white font-medium">{subOrder.quantity}</span>
                            </div>
                            {subOrder.departmentName && (
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-slate-400">{t('order.department')}:</span>
                                <span className="text-gray-900 dark:text-white font-medium">
                                  {subOrder.departmentName}
                                  {subOrder.departmentManagerName && ` (${subOrder.departmentManagerName})`}
                                </span>
                              </div>
                            )}
                            {(subOrder.length || subOrder.width || subOrder.cmp) && (
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-slate-400">{t('placeOrder.length')} / {t('placeOrder.width')} / {t('placeOrder.squareCm')} / {t('placeOrder.cmp')}:</span>
                                <span className="text-gray-900 dark:text-white">
                                  {subOrder.length || '-'} / {subOrder.width || '-'} / {subOrder.length && subOrder.width ? (parseFloat(subOrder.length) * parseFloat(subOrder.width)).toFixed(2) : '-'} / {subOrder.cmp || '-'}
                                </span>
                              </div>
                            )}
                            {subOrder.deliveryTime && (
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-slate-400">{t('placeOrder.deliveryTime')}:</span>
                                <span className="text-gray-900 dark:text-white font-medium">
                                  {new Date(subOrder.deliveryTime).toLocaleString('ro-RO', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            )}
                            {subOrder.description && (
                              <div className="pt-2 border-t border-gray-200 dark:border-slate-600">
                                <span className="text-gray-600 dark:text-slate-400">{t('placeOrder.description')}:</span>
                                <p className="text-gray-900 dark:text-white mt-1">{subOrder.description}</p>
                              </div>
                            )}
                            {subOrder.notes && (
                              <div className="pt-2 border-t border-gray-200 dark:border-slate-600">
                                <span className="text-gray-600 dark:text-slate-400">{t('placeOrder.notes')}:</span>
                                <p className="text-gray-900 dark:text-white mt-1">{subOrder.notes}</p>
                              </div>
                            )}
                            {subOrder.designFile && (
                              <div className="pt-2 border-t border-gray-200 dark:border-slate-600">
                                <span className="text-gray-600 dark:text-slate-400">{t('dashboard.orderModal.designFile')}:</span>
                                <a
                                  href={subOrder.designFile}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-blue-400 hover:underline block mt-1"
                                >
                                  {t('dashboard.orderModal.viewDesign')}
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Sub-order Status Update - Only for Team Members */}
                        {hasTeamAccess(userProfile) && !isEditing && (
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-600">
                            <h6 className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                              {t('order.updateSubOrderStatus')}
                            </h6>
                            <div className="flex gap-2 flex-wrap">
                              {Object.values(OrderStatus).map((status) => (
                                <button
                                  key={status}
                                  onClick={() => updateSubOrderStatus(subOrder.id, status)}
                                  disabled={subOrder.status === status || status === OrderStatus.PENDING_CONFIRMATION}
                                  className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                                    subOrder.status === status || status === OrderStatus.PENDING_CONFIRMATION
                                      ? 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-slate-400 cursor-not-allowed'
                                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600'
                                  }`}
                                >
                                  {getStatusLabel(status)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Invoice Section */}
            {selectedOrder.status === OrderStatus.COMPLETED && (
              <div className="mb-6 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-green-900 dark:text-green-200 mb-2">{t('dashboard.orderModal.orderCompleted')}</h4>
                    <p className="text-sm text-green-800 dark:text-green-300 mb-3">
                      {t('dashboard.orderModal.orderCompletedDesc')}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDownloadInvoice}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-green-600 dark:border-green-500 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/50 font-medium transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {t('dashboard.orderModal.downloadInvoice')}
                      </button>
                      <button
                        onClick={handleSendInvoice}
                        disabled={sendingInvoice}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-lg hover:opacity-90 font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {sendingInvoice ? t('dashboard.orderModal.sending') : t('dashboard.orderModal.sendToClient')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Confirmation Section */}
            {selectedOrder.status === OrderStatus.PENDING_CONFIRMATION && !selectedOrder.confirmedByClient && (
              <div className="mb-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">{t('dashboard.orderModal.confirmationNeeded')}</h4>
                    <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
                      {t('dashboard.orderModal.confirmationDesc')}
                    </p>
                    <button
                      data-testid="order-confirm-button"
                      onClick={confirmOrder}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:opacity-90 font-medium transition-opacity"
                    >
                      {t('dashboard.orderModal.confirmOrder')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Status Update Section */}
            {hasTeamAccess(userProfile) && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('dashboard.orderModal.updateStatus')}</h4>
                <div className="flex gap-2 flex-wrap">
                  {Object.values(OrderStatus).map((status) => (
                    <button
                      key={status}
                      data-testid={`order-status-button-${status}`}
                      onClick={() => updateOrderStatus(status)}
                      disabled={selectedOrder.status === status || status === OrderStatus.PENDING_CONFIRMATION}
                      className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                        selectedOrder.status === status || status === OrderStatus.PENDING_CONFIRMATION
                          ? 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-slate-400 cursor-not-allowed'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {getStatusLabel(status)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Updates Section */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('dashboard.orderModal.updatesComments')}</h4>

              {/* Updates List */}
              <div data-testid="order-updates-list" className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 mb-4 max-h-96 overflow-y-auto">
                {orderUpdates.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">
                    {t('dashboard.orderModal.noUpdates')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {orderUpdates
                      .filter((update) => {
                        const isClient = !hasTeamAccess(userProfile);
                        if (isClient && (update.isSystem || update.isAudit)) {
                          return false;
                        }
                        return true;
                      })
                      .map((update) => {
                      const isSystemMessage = update.isSystem;
                      const isClientMessage = !isSystemMessage && !update.isAdminOrTeamMember;
                      const canDelete = hasTeamAccess(userProfile) && !isSystemMessage && update.isAdminOrTeamMember;

                      return (
                        <div
                          key={update.id}
                          data-testid={`order-update-item-${update.id}`}
                          className={`flex gap-2 ${isClientMessage ? 'justify-end' : 'justify-start'} group`}
                        >
                          {!isSystemMessage && !isClientMessage && (
                            <div className="flex-shrink-0">
                              {update.userPhotoURL ? (
                                <img
                                  src={update.userPhotoURL}
                                  alt={update.userName}
                                  className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-slate-600"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold border border-gray-200 dark:border-slate-600">
                                  {getInitials(update.userName, update.userEmail)}
                                </div>
                              )}
                            </div>
                          )}

                          <div
                            className={`max-w-[75%] rounded-lg p-3 ${
                              update.isAudit
                                ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                                : isSystemMessage
                                ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                                : isClientMessage
                                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white'
                                : 'bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <span
                                className={`text-xs font-semibold ${
                                  update.isAudit
                                    ? 'text-amber-700 dark:text-amber-300'
                                    : isSystemMessage
                                    ? 'text-blue-700 dark:text-blue-300'
                                    : isClientMessage
                                    ? 'text-blue-100'
                                    : 'text-gray-900 dark:text-white'
                                }`}
                              >
                                {update.isAudit ? (update.editedBy || update.userName) : update.userName}
                              </span>
                              <span
                                className={`text-xs whitespace-nowrap ${
                                  update.isAudit
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : isSystemMessage
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : isClientMessage
                                    ? 'text-blue-100'
                                    : 'text-gray-500 dark:text-slate-400'
                                }`}
                              >
                                {(() => {
                                  const date = update.createdAt?.toDate();
                                  if (!date) return '';
                                  const dateStr = formatDate(date);
                                  const timeStr = date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
                                  return `${dateStr} - ${timeStr}`;
                                })()}
                              </span>
                            </div>
                            <p
                              className={`text-sm whitespace-pre-line ${
                                update.isAudit
                                  ? 'text-amber-800 dark:text-amber-200'
                                  : isSystemMessage
                                  ? 'text-blue-800 dark:text-white'
                                  : isClientMessage
                                  ? 'text-white'
                                  : 'text-gray-700 dark:text-slate-200'
                              }`}
                            >
                              {update.text?.startsWith('dashboard.') || update.text?.startsWith('order.') || update.text?.startsWith('placeOrder.')
                                ? t(update.text)
                                : update.text}
                            </p>
                            {update.attachmentURL && (
                              <div className="mt-2">
                                {update.attachmentType?.startsWith('image/') ? (
                                  <a href={update.attachmentURL} target="_blank" rel="noopener noreferrer" data-testid="order-update-attachment-link">
                                    <img
                                      src={update.attachmentURL}
                                      alt={update.attachmentName}
                                      className="max-w-full rounded-lg border border-gray-200 dark:border-slate-600 hover:opacity-90 transition-opacity cursor-pointer"
                                      style={{ maxHeight: '200px' }}
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={update.attachmentURL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    data-testid="order-update-attachment-link"
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                                      isClientMessage
                                        ? 'bg-blue-500/20 border-blue-300 hover:bg-blue-500/30'
                                        : 'bg-gray-100 dark:bg-slate-700 border-gray-300 dark:border-slate-600 hover:bg-gray-200 dark:hover:bg-slate-600'
                                    }`}
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span className="text-sm font-medium">{update.attachmentName || t('dashboard.orderModal.attachment')}</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>

                          {!isSystemMessage && isClientMessage && (
                            <div className="flex-shrink-0">
                              {update.userPhotoURL ? (
                                <img
                                  src={update.userPhotoURL}
                                  alt={update.userName}
                                  className="w-8 h-8 rounded-full object-cover border border-blue-200 dark:border-blue-700"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold border border-blue-200 dark:border-blue-700">
                                  {getInitials(update.userName, update.userEmail)}
                                </div>
                              )}
                            </div>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => {
                                setSelectedUpdateId(update.id);
                                setShowDeleteUpdateDialog(true);
                              }}
                              className="opacity-50 md:opacity-0 md:group-hover:opacity-100 hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 p-1 self-center"
                              title="Șterge actualizare"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <div ref={updatesEndRef} />
                  </div>
                )}
              </div>

              {/* Post Update Form */}
              <div className="space-y-2">
                <textarea
                  data-testid="order-update-message-input"
                  value={updateText}
                  onChange={(e) => setUpdateText(e.target.value)}
                  placeholder={t('dashboard.orderModal.addComment')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />

                {attachmentFile && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="text-sm text-blue-800 dark:text-blue-200 flex-1 truncate">{attachmentFile.name}</span>
                    <button
                      onClick={() => setAttachmentFile(null)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
                  <div className="w-full sm:w-auto">
                    <input
                      data-testid="order-update-file-input"
                      ref={attachmentInputRef}
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 10 * 1024 * 1024) {
                            showError(t('dashboard.orderModal.fileSizeError'));
                            return;
                          }
                          setAttachmentFile(file);
                        }
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => attachmentInputRef.current?.click()}
                      disabled={uploadingAttachment}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      {uploadingAttachment ? t('dashboard.orderModal.uploading') : t('dashboard.orderModal.attachFile')}
                    </button>
                  </div>

                  <button
                    data-testid="order-update-submit-button"
                    onClick={postUpdate}
                    disabled={postingUpdate || (!updateText.trim() && !attachmentFile)}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {postingUpdate ? t('dashboard.orderModal.posting') : t('dashboard.orderModal.postUpdate')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Order Dialog */}
      {showDeleteDialog && (
        <ConfirmDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={deleteOrder}
          title="Șterge comandă"
          message="Sigur doriți să ștergeți această comandă? Această acțiune nu poate fi anulată."
          confirmText="Șterge"
          cancelText="Anulează"
          type="danger"
          inline={true}
        />
      )}

      {/* Delete Update Dialog */}
      {showDeleteUpdateDialog && (
        <ConfirmDialog
          isOpen={showDeleteUpdateDialog}
          onClose={() => {
            setShowDeleteUpdateDialog(false);
            setSelectedUpdateId(null);
          }}
          onConfirm={handleDeleteUpdate}
          title="Șterge actualizare"
          message="Sigur doriți să ștergeți această actualizare? Această acțiune nu poate fi anulată."
          confirmText="Șterge"
          cancelText="Anulează"
          type="danger"
          inline={true}
        />
      )}
    </>
  );
}
