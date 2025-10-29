import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy as firestoreOrderBy, doc, updateDoc, addDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { OrderStatus, ProductType } from '../types';
import InviteTeamModal from '../components/InviteTeamModal';
import Notifications from '../components/Notifications';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [updateText, setUpdateText] = useState('');
  const [postingUpdate, setPostingUpdate] = useState(false);
  const [orderUpdates, setOrderUpdates] = useState([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Filter and sort states
  const [statusFilter, setStatusFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchOrders();
  }, [currentUser]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [orders, statusFilter, productFilter, sortBy, searchQuery]);

  async function fetchOrders() {
    if (!currentUser) return;

    try {
      setLoading(true);
      const ordersRef = collection(db, 'orders');
      const q = query(
        ordersRef,
        where('userId', '==', currentUser.uid),
        firestoreOrderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersData);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }

  function applyFiltersAndSort() {
    let filtered = [...orders];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Apply product filter
    if (productFilter !== 'all') {
      filtered = filtered.filter(order => order.productType === productFilter);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.id.toLowerCase().includes(query) ||
        order.productType.toLowerCase().includes(query) ||
        order.description?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'date-desc':
        filtered.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        break;
      case 'date-asc':
        filtered.sort((a, b) => a.createdAt?.toMillis() - b.createdAt?.toMillis());
        break;
      case 'quantity-desc':
        filtered.sort((a, b) => b.quantity - a.quantity);
        break;
      case 'quantity-asc':
        filtered.sort((a, b) => a.quantity - b.quantity);
        break;
      case 'status':
        filtered.sort((a, b) => a.status.localeCompare(b.status));
        break;
      default:
        break;
    }

    setFilteredOrders(filtered);
  }

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async function openOrderDetails(order) {
    setSelectedOrder(order);
    setShowOrderModal(true);
    await fetchOrderUpdates(order.id);
  }

  async function fetchOrderUpdates(orderId) {
    try {
      const updatesRef = collection(db, 'orderUpdates');
      const q = query(
        updatesRef,
        where('orderId', '==', orderId),
        firestoreOrderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const updates = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrderUpdates(updates);
    } catch (error) {
      console.error('Error fetching order updates:', error);
    }
  }

  async function postUpdate() {
    if (!updateText.trim() || !selectedOrder) return;

    try {
      setPostingUpdate(true);
      const updatesRef = collection(db, 'orderUpdates');
      await addDoc(updatesRef, {
        orderId: selectedOrder.id,
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        text: updateText.trim(),
        createdAt: Timestamp.now()
      });

      // Refresh updates
      await fetchOrderUpdates(selectedOrder.id);
      setUpdateText('');
    } catch (error) {
      console.error('Error posting update:', error);
      alert('Failed to post update');
    } finally {
      setPostingUpdate(false);
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
        userName: 'System',
        userEmail: currentUser.email,
        text: `Order status changed to: ${newStatus}`,
        isSystem: true,
        createdAt: Timestamp.now()
      });

      // Refresh orders and updates
      await fetchOrders();
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
        userName: 'System',
        userEmail: currentUser.email,
        text: `Comandă confirmată de client. Gata de procesare.`,
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

      // Refresh orders and updates
      await fetchOrders();
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
      // Delete the order
      const orderRef = doc(db, 'orders', selectedOrder.id);
      await deleteDoc(orderRef);

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

      // Close modal and refresh orders
      setShowOrderModal(false);
      await fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      alert('Eroare la ștergerea comenzii');
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case OrderStatus.PENDING_CONFIRMATION:
        return 'bg-orange-100 text-orange-800';
      case OrderStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800';
      case OrderStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800';
      case OrderStatus.COMPLETED:
        return 'bg-green-100 text-green-800';
      case OrderStatus.CANCELLED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--primary-black)' }}>
                Serigrafie Brasov
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/place-order')}
                className="px-4 py-2 rounded-lg text-white font-medium transition-colors"
                style={{ backgroundColor: 'var(--vivid-cyan)' }}
              >
                Place Order
              </button>
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Invite Team
              </button>
              <Notifications
                onNotificationClick={(orderId) => {
                  const order = orders.find(o => o.id === orderId);
                  if (order) {
                    openOrderDetails(order);
                  }
                }}
              />
              <div className="relative group">
                <button className="flex items-center space-x-2 text-gray-700 hover:text-gray-900">
                  <span>{currentUser?.displayName || currentUser?.email}</span>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 invisible group-hover:visible">
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-1">Total Orders</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-1">Pending</p>
            <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-1">In Progress</p>
            <p className="text-3xl font-bold text-blue-600">{stats.in_progress}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-1">Completed</p>
            <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vivid-cyan"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vivid-cyan"
              >
                <option value="all">All Statuses</option>
                <option value={OrderStatus.PENDING}>Pending</option>
                <option value={OrderStatus.IN_PROGRESS}>In Progress</option>
                <option value={OrderStatus.COMPLETED}>Completed</option>
                <option value={OrderStatus.CANCELLED}>Cancelled</option>
              </select>
            </div>

            {/* Product Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vivid-cyan"
              >
                <option value="all">All Products</option>
                <option value={ProductType.MUGS}>Mugs</option>
                <option value={ProductType.T_SHIRTS}>T-Shirts</option>
                <option value={ProductType.HOODIES}>Hoodies</option>
                <option value={ProductType.BAGS}>Bags</option>
                <option value={ProductType.CAPS}>Caps</option>
                <option value={ProductType.OTHER}>Other</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vivid-cyan"
              >
                <option value="date-desc">Date (Newest)</option>
                <option value="date-asc">Date (Oldest)</option>
                <option value="quantity-desc">Quantity (High to Low)</option>
                <option value="quantity-asc">Quantity (Low to High)</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Your Orders ({filteredOrders.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--vivid-cyan)' }}></div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
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
              <h3 className="mt-2 text-sm font-medium text-gray-900">No orders found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {orders.length === 0
                  ? 'Get started by placing your first order.'
                  : 'Try adjusting your filters.'}
              </p>
              {orders.length === 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => navigate('/place-order')}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white"
                    style={{ backgroundColor: 'var(--vivid-cyan)' }}
                  >
                    Place Order
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{order.id.substring(0, 8).toUpperCase()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.productType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.createdAt?.toDate().toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => openOrderDetails(order)}
                          className="text-vivid-cyan hover:underline font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Order Details Modal */}
      {showOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Order #{selectedOrder.id.substring(0, 8).toUpperCase()}
                </h3>
                <p className="text-sm text-gray-500">
                  Created {selectedOrder.createdAt?.toDate().toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors"
                  title="Delete order"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              {/* Order Details */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Order Details</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Product:</span>
                    <span className="text-sm font-medium text-gray-900">{selectedOrder.productType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Quantity:</span>
                    <span className="text-sm font-medium text-gray-900">{selectedOrder.quantity}</span>
                  </div>
                  {selectedOrder.deadline && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Deadline:</span>
                      <span className="text-sm font-medium text-gray-900">{selectedOrder.deadline}</span>
                    </div>
                  )}
                  {selectedOrder.contactPhone && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Phone:</span>
                      <span className="text-sm font-medium text-gray-900">{selectedOrder.contactPhone}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-sm text-gray-600">Description:</span>
                    <p className="text-sm text-gray-900 mt-1">{selectedOrder.description}</p>
                  </div>
                  {selectedOrder.notes && (
                    <div className="pt-2 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Notes:</span>
                      <p className="text-sm text-gray-900 mt-1">{selectedOrder.notes}</p>
                    </div>
                  )}
                  {selectedOrder.designFile && (
                    <div className="pt-2 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Design File:</span>
                      <a
                        href={selectedOrder.designFile}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline block mt-1"
                      >
                        View Design
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Confirmation Section - Only show if order needs confirmation */}
              {selectedOrder.status === OrderStatus.PENDING_CONFIRMATION && !selectedOrder.confirmedByClient && (
                <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-orange-900 mb-2">Confirmare necesară</h4>
                      <p className="text-sm text-orange-800 mb-3">
                        Vă rugăm să verificați toate detaliile comenzii. După confirmare, comanda va fi trimisă spre procesare.
                      </p>
                      <button
                        onClick={() => setShowConfirmDialog(true)}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium transition-colors"
                      >
                        ✓ Confirm comandă
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Status Update Section */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Update Status</h4>
                <div className="flex gap-2 flex-wrap">
                  {Object.values(OrderStatus).map((status) => (
                    <button
                      key={status}
                      onClick={() => updateOrderStatus(status)}
                      disabled={selectedOrder.status === status || status === OrderStatus.PENDING_CONFIRMATION}
                      className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                        selectedOrder.status === status || status === OrderStatus.PENDING_CONFIRMATION
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Updates Section */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Updates & Comments</h4>

                {/* Post Update Form */}
                <div className="mb-4">
                  <textarea
                    value={updateText}
                    onChange={(e) => setUpdateText(e.target.value)}
                    placeholder="Add a comment or update..."
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-vivid-cyan"
                  />
                  <button
                    onClick={postUpdate}
                    disabled={!updateText.trim() || postingUpdate}
                    className="mt-2 px-4 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--vivid-cyan)' }}
                  >
                    {postingUpdate ? 'Posting...' : 'Post Update'}
                  </button>
                </div>

                {/* Updates List */}
                <div className="space-y-3">
                  {orderUpdates.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No updates yet. Be the first to add one!
                    </p>
                  ) : (
                    orderUpdates.map((update) => (
                      <div key={update.id} className={`p-3 rounded-lg ${update.isSystem ? 'bg-blue-50' : 'bg-gray-50'}`}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {update.userName}
                          </span>
                          <span className="text-xs text-gray-500">
                            {update.createdAt?.toDate().toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{update.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Team Modal */}
      <InviteTeamModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />

      {/* Confirm Order Dialog */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={confirmOrder}
        title="Confirmare comandă"
        message="Confirmați că toate detaliile comenzii sunt corecte și comanda poate fi procesată?"
        confirmText="Confirmă"
        cancelText="Anulează"
        type="warning"
      />

      {/* Delete Order Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={deleteOrder}
        title="Șterge comandă"
        message="Sigur doriți să ștergeți această comandă? Această acțiune nu poate fi anulată."
        confirmText="Șterge"
        cancelText="Anulează"
        type="danger"
      />
    </div>
  );
}
