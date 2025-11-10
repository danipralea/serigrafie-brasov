import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot, Timestamp } from 'firebase/firestore';
import { OrderStatus, ProductType } from '../types';
import AppShell from '../components/AppShell';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

const PRODUCT_COLORS: { [key: string]: string } = {
  [ProductType.MUGS]: '#8b5cf6',
  [ProductType.T_SHIRTS]: '#3b82f6',
  [ProductType.HOODIES]: '#10b981',
  [ProductType.BAGS]: '#f59e0b',
  [ProductType.CAPS]: '#ef4444',
  [ProductType.OTHER]: '#6b7280',
};

const STATUS_COLORS: { [key: string]: string } = {
  [OrderStatus.PENDING_CONFIRMATION]: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  [OrderStatus.PENDING]: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  [OrderStatus.IN_PROGRESS]: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  [OrderStatus.COMPLETED]: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  [OrderStatus.CANCELLED]: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800',
};

type ViewMode = 'month' | 'week';

export default function Calendar() {
  const { t } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [filterProduct, setFilterProduct] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser || !userProfile) return;

    const ordersRef = collection(db, 'orders');
    let q;

    // Admins and team members see all orders
    if (userProfile?.isAdmin || userProfile?.isTeamMember) {
      q = query(ordersRef);
    } else {
      // Regular clients only see their own orders
      q = query(ordersRef, where('userId', '==', currentUser.uid));
    }

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
              orderId: orderDoc.id,  // Add parent order ID for reference
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

      setOrders(ordersWithSubOrders);
    });

    return () => unsubscribe();
  }, [currentUser, userProfile]);

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();

    const days: (Date | null)[] = [];

    for (let i = 0; i < startDay; i++) {
      const prevMonthDay = new Date(year, month, -(startDay - i - 1));
      days.push(prevMonthDay);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  };

  const getDaysInWeek = () => {
    const days: Date[] = [];
    const startOfWeek = new Date(currentDate);
    const dayOfWeek = startOfWeek.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(startOfWeek.getDate() - daysToMonday);

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }

    return days;
  };

  const getOrdersForDay = (date: Date) => {
    // Flatten all sub-orders from all orders, keeping parent info
    const allSubOrders = orders.flatMap(order =>
      (order.subOrders || []).map(subOrder => ({
        ...subOrder,
        parentOrderId: order.id,
        clientName: order.clientName,
        clientCompany: order.clientCompany,
        parentStatus: order.status
      }))
    );

    return allSubOrders.filter(subOrder => {
      if (!subOrder.deliveryTime) return false;

      const deliveryDate = new Date(subOrder.deliveryTime);
      const isSameDay = deliveryDate.getDate() === date.getDate() &&
        deliveryDate.getMonth() === date.getMonth() &&
        deliveryDate.getFullYear() === date.getFullYear();

      const matchesProduct = filterProduct === 'all' || subOrder.productType === filterProduct;
      const matchesStatus = filterStatus === 'all' || subOrder.status === filterStatus;

      return isSameDay && matchesProduct && matchesStatus;
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const navigateMonth = (direction: number) => {
    if (viewMode === 'week') {
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + (direction * 7));
      setCurrentDate(newDate);
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const getProductLabel = (productType: string) => {
    const key = productType.replace(/-/g, '');
    return t(`productType.${key}`) || productType;
  };

  const getStatusLabel = (status: string) => {
    return t(`orderStatus.${status}`) || status;
  };

  const days = viewMode === 'week' ? getDaysInWeek() : getDaysInMonth();
  const monthYear = currentDate.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });

  return (
    <AppShell title={t('calendar.title')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-end space-x-3 mb-4">
              {/* Product Filter */}
              <div className="relative">
                <select
                  value={filterProduct}
                  onChange={(e) => setFilterProduct(e.target.value)}
                  className="appearance-none h-9 pl-3 pr-8 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  <option value="all">{t('calendar.allProducts')}</option>
                  <option value={ProductType.MUGS}>{t('productType.mugs')}</option>
                  <option value={ProductType.T_SHIRTS}>{t('productType.tshirts')}</option>
                  <option value={ProductType.HOODIES}>{t('productType.hoodies')}</option>
                  <option value={ProductType.BAGS}>{t('productType.bags')}</option>
                  <option value={ProductType.CAPS}>{t('productType.caps')}</option>
                  <option value={ProductType.OTHER}>{t('productType.other')}</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="appearance-none h-9 pl-3 pr-8 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  <option value="all">{t('calendar.allStatuses')}</option>
                  <option value={OrderStatus.PENDING_CONFIRMATION}>{t('calendar.statusPendingConfirmation')}</option>
                  <option value={OrderStatus.PENDING}>{t('calendar.statusPending')}</option>
                  <option value={OrderStatus.IN_PROGRESS}>{t('calendar.statusInProgress')}</option>
                  <option value={OrderStatus.COMPLETED}>{t('calendar.statusCompleted')}</option>
                  <option value={OrderStatus.CANCELLED}>{t('calendar.statusCancelled')}</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>

              {/* View Mode Toggle */}
              <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-4 py-1.5 text-sm ${
                    viewMode === 'month'
                      ? 'bg-gray-900 dark:bg-gray-700 text-white'
                      : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {t('calendar.month')}
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-4 py-1.5 text-sm border-l border-gray-300 dark:border-gray-600 ${
                    viewMode === 'week'
                      ? 'bg-gray-900 dark:bg-gray-700 text-white'
                      : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {t('calendar.week')}
                </button>
              </div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 min-w-[200px] text-center capitalize">
                  {monthYear}
                </h3>
                <button
                  onClick={() => navigateMonth(1)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>
              </div>

              <button
                onClick={goToToday}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm rounded-lg hover:opacity-90 transition-opacity"
              >
                {t('calendar.today')}
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="p-6">
            {/* Day Headers */}
            {viewMode === 'month' && (
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => (
                  <div
                    key={day}
                    className="py-3 text-center text-sm font-medium text-gray-600 dark:text-gray-400 capitalize"
                  >
                    {t(`calendar.${day}`)}
                  </div>
                ))}
              </div>
            )}

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
              {days.map((date, index) => {
                if (!date) return null;
                const dayOrders = getOrdersForDay(date);
                const today = isToday(date);
                const currentMonth = isCurrentMonth(date);

                return (
                  <div
                    key={index}
                    className={`${viewMode === 'week' ? 'min-h-[200px]' : 'min-h-[120px]'} px-3 py-3 cursor-pointer rounded-lg border transition-all ${
                      today
                        ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700'
                    } hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm`}
                  >
                    {/* Week view: show day name */}
                    {viewMode === 'week' && (
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center mb-1 capitalize">
                        {t(`calendar.${['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][(date.getDay() + 6) % 7]}`)}
                      </div>
                    )}

                    <div className={`mb-1.5 ${viewMode === 'week' ? 'flex justify-center' : ''}`}>
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 text-sm font-medium rounded-full ${
                          today
                            ? 'bg-blue-500 text-white ring-2 ring-blue-200 dark:ring-blue-800'
                            : viewMode === 'month' && !currentMonth
                            ? 'text-gray-400 dark:text-gray-600'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        {date.getDate()}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {dayOrders.map((subOrder) => {
                        const statusClass = STATUS_COLORS[subOrder.status] || '';
                        const productColor = PRODUCT_COLORS[subOrder.productType] || '#6b7280';

                        return (
                          <div
                            key={subOrder.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('/dashboard', { state: { openOrderId: subOrder.parentOrderId } });
                            }}
                            className="text-xs rounded bg-white dark:bg-slate-700 hover:shadow-md transition-shadow cursor-pointer border-l-[3px] border border-gray-100 dark:border-gray-900 p-1.5"
                            style={{ borderLeftColor: productColor }}
                          >
                            <div className="font-medium text-gray-900 dark:text-gray-100 truncate mb-1">
                              {subOrder.productTypeName || subOrder.productType} ({subOrder.quantity})
                            </div>
                            {subOrder.clientName && (
                              <div className="text-[10px] text-gray-600 dark:text-gray-400 truncate mb-1">
                                {subOrder.clientName}
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusClass}`}>
                                {getStatusLabel(subOrder.status)}
                              </span>
                              {subOrder.deliveryTime && (
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                  {formatTime(new Date(subOrder.deliveryTime))}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
