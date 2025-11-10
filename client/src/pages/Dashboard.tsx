import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy as firestoreOrderBy, doc, updateDoc, addDoc, deleteDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { OrderStatus, ProductType } from '../types';
import InviteTeamModal from '../components/InviteTeamModal';
import PlaceOrderModal from '../components/PlaceOrderModal';
import Notifications from '../components/Notifications';
import ConfirmDialog from '../components/ConfirmDialog';
import AppShell from '../components/AppShell';
import OrderDetailsModal from '../components/OrderDetailsModal';
import { downloadInvoice, sendInvoiceToClient } from '../services/invoiceService';
import { uploadFile } from '../services/storageService';
import { showSuccess, showError } from '../services/notificationService';

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPlaceOrderModal, setShowPlaceOrderModal] = useState(false);
  const [initialOrderData, setInitialOrderData] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [updateText, setUpdateText] = useState('');
  const [postingUpdate, setPostingUpdate] = useState(false);
  const [orderUpdates, setOrderUpdates] = useState([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const attachmentInputRef = useRef(null);
  const updatesEndRef = useRef(null);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [showDeleteUpdateDialog, setShowDeleteUpdateDialog] = useState(false);
  const [selectedUpdateId, setSelectedUpdateId] = useState(null);

  // Tab and filter states
  const [activeTab, setActiveTab] = useState('current'); // 'current' or 'past'
  const [statusFilter, setStatusFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [sortBy, setSortBy] = useState('delivery-asc');
  const [searchQuery, setSearchQuery] = useState('');

  // Helper function to get earliest delivery time from sub-orders
  function getEarliestDeliveryTime(subOrders) {
    if (!subOrders || subOrders.length === 0) return null;

    const times = subOrders
      .map(so => so.deliveryTime)
      .filter(dt => dt); // Filter out null/undefined

    if (times.length === 0) return null;

    return times.reduce((earliest, current) => {
      return new Date(current) < new Date(earliest) ? current : earliest;
    });
  }

  useEffect(() => {
    if (!currentUser || !userProfile) return;

    // Set up real-time listener for orders
    const ordersRef = collection(db, 'orders');
    let q;

    // Admins and team members see all orders
    if (userProfile?.isAdmin || userProfile?.isTeamMember) {
      q = query(
        ordersRef,
        firestoreOrderBy('createdAt', 'desc')
      );
    } else {
      // Regular clients only see their own orders
      q = query(
        ordersRef,
        where('userId', '==', currentUser.uid)
      );
    }

    setLoading(true);
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Fetch orders with their sub-orders
      const ordersWithSubOrders = await Promise.all(
        snapshot.docs.map(async (orderDoc) => {
          const orderData = {
            id: orderDoc.id,
            ...orderDoc.data()
          };

          // Fetch sub-orders for this order
          try {
            const subOrdersRef = collection(db, 'orders', orderDoc.id, 'subOrders');
            const subOrdersSnapshot = await getDocs(subOrdersRef);
            const subOrders = subOrdersSnapshot.docs.map(subDoc => ({
              id: subDoc.id,
              ...subDoc.data()
            }));

            return {
              ...orderData,
              subOrders: subOrders || []
            };
          } catch (error) {
            console.error(`Error fetching sub-orders for order ${orderDoc.id}:`, error);
            return {
              ...orderData,
              subOrders: []
            };
          }
        })
      );

      // Sort in memory for client queries (to avoid composite index requirement)
      if (!userProfile?.isAdmin && !userProfile?.isTeamMember) {
        ordersWithSubOrders.sort((a, b) => {
          const timeA = a.createdAt?.toMillis() || 0;
          const timeB = b.createdAt?.toMillis() || 0;
          return timeB - timeA; // desc order
        });
      }

      setOrders(ordersWithSubOrders);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching orders:', error);
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, userProfile]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [orders, activeTab, statusFilter, productFilter, sortBy, searchQuery]);

  // Check if we need to open a specific order from notification
  useEffect(() => {
    if (location.state?.openOrderId && orders.length > 0) {
      const orderToOpen = orders.find(o => o.id === location.state.openOrderId);
      if (orderToOpen) {
        openOrderDetails(orderToOpen);
        // Clear the state so it doesn't reopen on refresh
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, orders]);

  // Handle Escape key to close order details modal
  useEffect(() => {
    function handleEscapeKey(event) {
      if (event.key === 'Escape' && selectedOrder) {
        setSelectedOrder(null);
      }
    }

    if (selectedOrder) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [selectedOrder]);

  // Auto-scroll to latest update
  useEffect(() => {
    if (orderUpdates.length > 0 && updatesEndRef.current) {
      updatesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [orderUpdates]);


  function applyFiltersAndSort() {
    let filtered = [...orders];

    // Apply tab filter - separate current and past orders
    if (activeTab === 'current') {
      // Current orders: pending_confirmation, pending, in_progress
      filtered = filtered.filter(order =>
        order.status === OrderStatus.PENDING_CONFIRMATION ||
        order.status === OrderStatus.PENDING ||
        order.status === OrderStatus.IN_PROGRESS
      );
    } else {
      // Past orders: completed, cancelled
      filtered = filtered.filter(order =>
        order.status === OrderStatus.COMPLETED ||
        order.status === OrderStatus.CANCELLED
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Apply product filter - check sub-orders
    if (productFilter !== 'all') {
      filtered = filtered.filter(order =>
        order.subOrders?.some(so => so.productType === productFilter)
      );
    }

    // Apply search - check all fields in order and sub-orders
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => {
        // Search in parent order fields
        const orderMatches =
          order.id.toLowerCase().includes(query) ||
          order.clientName?.toLowerCase().includes(query) ||
          order.clientEmail?.toLowerCase().includes(query) ||
          order.clientPhone?.toLowerCase().includes(query) ||
          order.clientCompany?.toLowerCase().includes(query) ||
          order.userName?.toLowerCase().includes(query) ||
          order.userEmail?.toLowerCase().includes(query) ||
          order.status?.toLowerCase().includes(query);

        // Search in sub-order fields
        const subOrderMatches = order.subOrders?.some(so =>
          so.productType?.toLowerCase().includes(query) ||
          so.productTypeName?.toLowerCase().includes(query) ||
          so.quantity?.toString().includes(query) ||
          so.length?.toString().includes(query) ||
          so.width?.toString().includes(query) ||
          so.cmp?.toString().includes(query) ||
          so.description?.toLowerCase().includes(query) ||
          so.designFile?.toLowerCase().includes(query) ||
          so.notes?.toLowerCase().includes(query) ||
          so.status?.toLowerCase().includes(query)
        );

        return orderMatches || subOrderMatches;
      });
    }

    // Apply sorting - use earliest delivery time from sub-orders
    switch (sortBy) {
      case 'delivery-asc':
        filtered.sort((a, b) => {
          const aEarliest = getEarliestDeliveryTime(a.subOrders);
          const bEarliest = getEarliestDeliveryTime(b.subOrders);
          if (!aEarliest) return 1;
          if (!bEarliest) return -1;
          return new Date(aEarliest).getTime() - new Date(bEarliest).getTime();
        });
        break;
      case 'delivery-desc':
        filtered.sort((a, b) => {
          const aEarliest = getEarliestDeliveryTime(a.subOrders);
          const bEarliest = getEarliestDeliveryTime(b.subOrders);
          if (!aEarliest) return 1;
          if (!bEarliest) return -1;
          return new Date(bEarliest).getTime() - new Date(aEarliest).getTime();
        });
        break;
      case 'date-desc':
        filtered.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        break;
      case 'date-asc':
        filtered.sort((a, b) => a.createdAt?.toMillis() - b.createdAt?.toMillis());
        break;
      case 'quantity-desc':
        filtered.sort((a, b) => {
          const aTotal = (a.subOrders || []).reduce((sum, so) => sum + (so.quantity || 0), 0);
          const bTotal = (b.subOrders || []).reduce((sum, so) => sum + (so.quantity || 0), 0);
          return bTotal - aTotal;
        });
        break;
      case 'quantity-asc':
        filtered.sort((a, b) => {
          const aTotal = (a.subOrders || []).reduce((sum, so) => sum + (so.quantity || 0), 0);
          const bTotal = (b.subOrders || []).reduce((sum, so) => sum + (so.quantity || 0), 0);
          return aTotal - bTotal;
        });
        break;
      case 'status':
        filtered.sort((a, b) => a.status.localeCompare(b.status));
        break;
      default:
        break;
    }

    setFilteredOrders(filtered);
  }


  async function openOrderDetails(order) {
    setSelectedOrder(order);
    setShowOrderModal(true);
    await fetchOrderUpdates(order.id);
  }

  function handleReorder(e, order) {
    e.stopPropagation(); // Prevent row click from opening order details
    setInitialOrderData(order);
    setShowPlaceOrderModal(true);
  }

  async function fetchOrderUpdates(orderId) {
    try {
      const updatesRef = collection(db, 'orderUpdates');
      const q = query(
        updatesRef,
        where('orderId', '==', orderId)
      );
      const snapshot = await getDocs(q);
      const updates = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort in memory instead of using Firestore orderBy to avoid index requirement
      updates.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeA - timeB; // asc order (oldest first, like a chat conversation)
      });

      setOrderUpdates(updates);
    } catch (error) {
      console.error('Error fetching order updates:', error);
      alert(`Error fetching updates: ${error.message}`);
      // Set empty array on error so UI still works
      setOrderUpdates([]);
    }
  }

  function getInitials(name, email) {
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
    // Check if there's either text or attachment
    if ((!updateText.trim() && !attachmentFile) || !selectedOrder) return;

    try {
      setPostingUpdate(true);

      let attachmentURL = null;
      let attachmentName = null;
      let attachmentType = null;

      // Upload attachment if present
      if (attachmentFile) {
        try {
          setUploadingAttachment(true);
          const result = await uploadFile(attachmentFile, 'updates', currentUser.uid);
          attachmentURL = result.url;
          attachmentName = result.name;
          attachmentType = result.type;
        } catch (uploadError) {
          console.error('Error uploading attachment:', uploadError);
          alert(t('dashboard.orderModal.attachmentUploadFailed'));
        } finally {
          setUploadingAttachment(false);
        }
      }

      const updatesRef = collection(db, 'orderUpdates');
      const updateData = {
        orderId: selectedOrder.id,
        userId: currentUser.uid,
        userName: userProfile?.displayName || currentUser.displayName || currentUser.email || 'Unknown',
        userEmail: currentUser.email || '',
        userPhotoURL: userProfile?.photoURL || '',
        isAdminOrTeamMember: userProfile?.isAdmin || userProfile?.isTeamMember || false,
        text: updateText.trim() || '',
        createdAt: Timestamp.now()
      };

      // Add attachment data if present
      if (attachmentURL) {
        updateData.attachmentURL = attachmentURL;
        updateData.attachmentName = attachmentName;
        updateData.attachmentType = attachmentType;
      }

      const docRef = await addDoc(updatesRef, updateData);

      // Refresh updates
      await fetchOrderUpdates(selectedOrder.id);
      setUpdateText('');
      setAttachmentFile(null);
    } catch (error) {
      console.error('Error posting update:', error);
      alert(`Failed to post update: ${error.message || 'Unknown error'}`);
    } finally {
      setPostingUpdate(false);
      setUploadingAttachment(false);
    }
  }

  async function updateOrderStatus(newStatus) {
    if (!selectedOrder) return;

    try {
      const orderRef = doc(db, 'orders', selectedOrder.id);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: Timestamp.now()
      });

      // Add system update
      const updatesRef = collection(db, 'orderUpdates');
      await addDoc(updatesRef, {
        orderId: selectedOrder.id,
        userId: currentUser.uid,
        userName: t('dashboard.orderModal.system'),
        userEmail: currentUser.email,
        text: `${t('dashboard.orderModal.statusChangedTo')} ${getStatusLabel(newStatus)}`,
        isSystem: true,
        createdAt: Timestamp.now()
      });

      // Refresh updates
      await fetchOrderUpdates(selectedOrder.id);
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Failed to update order status');
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

      // Add system update
      const updatesRef = collection(db, 'orderUpdates');
      await addDoc(updatesRef, {
        orderId: selectedOrder.id,
        userId: currentUser.uid,
        userName: t('dashboard.orderModal.system'),
        userEmail: currentUser.email,
        text: t('dashboard.orderModal.orderConfirmedByClient'),
        isSystem: true,
        createdAt: Timestamp.now()
      });

      // Create notification
      const notificationsRef = collection(db, 'notifications');
      await addDoc(notificationsRef, {
        userId: currentUser.uid,
        type: 'order_confirmed',
        title: 'Comandă confirmată',
        message: `Comanda #${selectedOrder.id.substring(0, 8).toUpperCase()} a fost confirmată și este gata de procesare`,
        orderId: selectedOrder.id,
        read: false,
        createdAt: Timestamp.now()
      });

      // Refresh updates
      await fetchOrderUpdates(selectedOrder.id);
      setSelectedOrder({ ...selectedOrder, status: OrderStatus.PENDING, confirmedByClient: true });
    } catch (error) {
      console.error('Error confirming order:', error);
      alert('Eroare la confirmarea comenzii');
    }
  }

  async function deleteOrder() {
    if (!selectedOrder) return;

    try {
      // Delete sub-orders first
      const subOrdersRef = collection(db, 'orders', selectedOrder.id, 'subOrders');
      const subOrdersSnapshot = await getDocs(subOrdersRef);
      const deleteSubOrderPromises = subOrdersSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteSubOrderPromises);

      // Delete all updates related to this order
      const updatesRef = collection(db, 'orderUpdates');
      const updatesQuery = query(updatesRef, where('orderId', '==', selectedOrder.id));
      const updatesSnapshot = await getDocs(updatesQuery);
      const deletePromises = updatesSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // Delete all notifications related to this order
      const notificationsRef = collection(db, 'notifications');
      const notificationsQuery = query(notificationsRef, where('orderId', '==', selectedOrder.id));
      const notificationsSnapshot = await getDocs(notificationsQuery);
      const deleteNotifPromises = notificationsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteNotifPromises);

      // Delete the order document itself
      const orderRef = doc(db, 'orders', selectedOrder.id);
      await deleteDoc(orderRef);

      // Close modal and dialog - orders will update automatically via listener
      setShowOrderModal(false);
      setShowDeleteDialog(false);

      // Show success notification
      showSuccess(t('dashboard.orderModal.orderDeleted'));
    } catch (error: any) {
      console.error('Error deleting order:', error);

      // Show user-friendly error message
      let errorMessage = t('dashboard.orderModal.deleteError');
      if (error?.code === 'permission-denied') {
        errorMessage = t('dashboard.orderModal.deletePermissionError');
      }

      showError(errorMessage);

      // Re-throw error so ConfirmDialog knows it failed
      throw error;
    }
  }

  async function handleDeleteUpdate() {
    if (!selectedUpdateId) return;

    try {
      const updateRef = doc(db, 'orderUpdates', selectedUpdateId);
      await deleteDoc(updateRef);

      // Refresh updates
      if (selectedOrder) {
        await fetchOrderUpdates(selectedOrder.id);
      }
    } catch (error) {
      console.error('Error deleting update:', error);
      alert('Eroare la ștergerea actualizării');
    } finally {
      setShowDeleteUpdateDialog(false);
      setSelectedUpdateId(null);
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
        amount: undefined // You can add pricing logic here
      });
    } catch (error) {
      console.error('Error downloading invoice:', error);
      alert(t('dashboard.orderModal.downloadInvoiceError'));
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
        amount: undefined // You can add pricing logic here
      });
      alert(t('dashboard.orderModal.invoiceSentSuccess'));
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert(t('dashboard.orderModal.sendInvoiceError'));
    } finally {
      setSendingInvoice(false);
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case OrderStatus.PENDING_CONFIRMATION:
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
      case OrderStatus.PENDING:
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      case OrderStatus.IN_PROGRESS:
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case OrderStatus.COMPLETED:
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case OrderStatus.CANCELLED:
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300';
    }
  }

  function getStatusLabel(status) {
    switch (status) {
      case OrderStatus.PENDING_CONFIRMATION:
        return t('dashboard.orderModal.statuses.pendingConfirmation');
      case OrderStatus.PENDING:
        return t('dashboard.orderModal.statuses.confirmed');
      case OrderStatus.IN_PROGRESS:
        return t('dashboard.orderModal.statuses.inProduction');
      case OrderStatus.COMPLETED:
        return t('dashboard.orderModal.statuses.completed');
      case OrderStatus.CANCELLED:
        return t('dashboard.orderModal.statuses.cancelled');
      default:
        return status;
    }
  }

  function getProductLabel(productType) {
    switch (productType) {
      case ProductType.MUGS:
        return t('placeOrder.products.mugs');
      case ProductType.T_SHIRTS:
        return t('placeOrder.products.tshirts');
      case ProductType.HOODIES:
        return t('placeOrder.products.hoodies');
      case ProductType.BAGS:
        return t('placeOrder.products.bags');
      case ProductType.CAPS:
        return t('placeOrder.products.caps');
      case ProductType.OTHER:
        return t('placeOrder.products.other');
      default:
        return productType;
    }
  }

  function getOrderStats() {
    return {
      total: orders.length,
      pending: orders.filter(o => o.status === OrderStatus.PENDING).length,
      in_progress: orders.filter(o => o.status === OrderStatus.IN_PROGRESS).length,
      completed: orders.filter(o => o.status === OrderStatus.COMPLETED).length
    };
  }

  const stats = getOrderStats();

  return (
    <AppShell title={t('dashboard.title')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards - Only for admins and team members */}
        {(userProfile?.isAdmin || userProfile?.isTeamMember) && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-700 transition-colors">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{t('dashboard.stats.total')}</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-700 transition-colors">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{t('dashboard.stats.pending')}</p>
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-500">{stats.pending}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-700 transition-colors">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{t('dashboard.stats.inProgress')}</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-500">{stats.in_progress}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-700 transition-colors">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{t('dashboard.stats.completed')}</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-500">{stats.completed}</p>
            </div>
          </div>
        )}

        {/* Filters and Search - Only for admins and team members */}
        {(userProfile?.isAdmin || userProfile?.isTeamMember) && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 mb-6 border border-slate-200 dark:border-slate-700 transition-colors">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('dashboard.filters.search')}</label>
              <input
                type="text"
                placeholder={t('dashboard.filters.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('dashboard.filters.status')}</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <option value="all">{t('dashboard.filters.allStatuses')}</option>
                <option value={OrderStatus.PENDING}>{getStatusLabel(OrderStatus.PENDING)}</option>
                <option value={OrderStatus.IN_PROGRESS}>{getStatusLabel(OrderStatus.IN_PROGRESS)}</option>
                <option value={OrderStatus.COMPLETED}>{getStatusLabel(OrderStatus.COMPLETED)}</option>
                <option value={OrderStatus.CANCELLED}>{getStatusLabel(OrderStatus.CANCELLED)}</option>
              </select>
            </div>

            {/* Product Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('dashboard.filters.product')}</label>
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <option value="all">{t('dashboard.filters.allProducts')}</option>
                <option value={ProductType.MUGS}>{t('placeOrder.products.mugs')}</option>
                <option value={ProductType.T_SHIRTS}>{t('placeOrder.products.tshirts')}</option>
                <option value={ProductType.HOODIES}>{t('placeOrder.products.hoodies')}</option>
                <option value={ProductType.BAGS}>{t('placeOrder.products.bags')}</option>
                <option value={ProductType.CAPS}>{t('placeOrder.products.caps')}</option>
                <option value={ProductType.OTHER}>{t('placeOrder.products.other')}</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('dashboard.filters.sortBy')}</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <option value="delivery-asc">{t('dashboard.filters.deliveryEarliest')}</option>
                <option value="delivery-desc">{t('dashboard.filters.deliveryLatest')}</option>
                <option value="date-desc">{t('dashboard.filters.dateNewest')}</option>
                <option value="date-asc">{t('dashboard.filters.dateOldest')}</option>
                <option value="quantity-desc">{t('dashboard.filters.quantityHigh')}</option>
                <option value="quantity-asc">{t('dashboard.filters.quantityLow')}</option>
                <option value="status">{t('dashboard.filters.byStatus')}</option>
              </select>
            </div>
          </div>
        </div>
        )}

        {/* Tab Bar - Current vs Past Orders */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-colors mb-6">
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('past')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors relative ${
                activeTab === 'past'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t('dashboard.tabs.pastOrders')}
              {activeTab === 'past' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('current')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors relative ${
                activeTab === 'current'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t('dashboard.tabs.currentOrders')}
              {activeTab === 'current' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
              )}
            </button>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white whitespace-nowrap">
              {t(userProfile?.isAdmin || userProfile?.isTeamMember ? 'dashboard.table.orders' : 'dashboard.table.yourOrders')} ({filteredOrders.length})
            </h2>
            <button
              onClick={() => setShowPlaceOrderModal(true)}
              title={t('dashboard.addOrderTitle')}
              className="px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium transition-opacity hover:opacity-90 flex items-center gap-2 focus:outline-none shrink-0"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="whitespace-nowrap text-sm sm:text-base">{t('dashboard.addOrder')}</span>
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-white">{t('dashboard.table.noOrders')}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {orders.length === 0
                  ? t('dashboard.table.noOrdersDesc')
                  : t('dashboard.table.adjustFilters')}
              </p>
              {orders.length === 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowPlaceOrderModal(true)}
                    className="inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90 transition-opacity focus:outline-none"
                  >
                    {t('nav.placeOrder')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 table-fixed">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('dashboard.table.client')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('dashboard.table.items')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('dashboard.table.delivery')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('dashboard.table.status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('dashboard.table.date')}
                    </th>
                    {activeTab === 'past' && !userProfile?.isAdmin && !userProfile?.isTeamMember && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t('dashboard.table.actions')}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredOrders.map((order) => {
                    const totalItems = (order.subOrders || []).length;
                    const totalQuantity = (order.subOrders || []).reduce((sum, so) => sum + (so.quantity || 0), 0);
                    const earliestDelivery = getEarliestDeliveryTime(order.subOrders);

                    return (
                      <tr
                        key={order.id}
                        onClick={() => openOrderDetails(order)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 text-sm">
                          <div className="font-medium text-slate-900 dark:text-white">{order.clientName || '-'}</div>
                          {order.clientCompany && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">{order.clientCompany}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                          <div>{totalItems} {totalItems === 1 ? t('dashboard.table.item') : t('dashboard.table.items')}</div>
                          <div className="text-xs text-slate-400 dark:text-slate-500">{totalQuantity} {t('dashboard.table.pcs')}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                          {earliestDelivery ? (
                            <>
                              <div>{new Date(earliestDelivery).toLocaleDateString('ro-RO')}</div>
                              <div className="text-xs text-slate-400 dark:text-slate-500">
                                {new Date(earliestDelivery).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                          {(() => {
                            const date = order.createdAt?.toDate();
                            if (!date) return '';
                            const dateStr = date.toLocaleDateString('ro-RO');
                            const timeStr = date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
                            return `${dateStr} - ${timeStr}`;
                          })()}
                        </td>
                        {activeTab === 'past' && !userProfile?.isAdmin && !userProfile?.isTeamMember && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => handleReorder(e, order)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors focus:outline-none"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              {t('dashboard.table.reorder')}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      {/* Order Details Modal */}
      <OrderDetailsModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        order={selectedOrder}
      />

      {/* Place Order Modal */}
      <PlaceOrderModal
        open={showPlaceOrderModal}
        onClose={() => {
          setShowPlaceOrderModal(false);
          setInitialOrderData(null);
        }}
        onSuccess={() => {
          setShowPlaceOrderModal(false);
          setInitialOrderData(null);
          // Order will appear automatically via real-time listener
        }}
      />
      </div>
    </AppShell>
  );
}
