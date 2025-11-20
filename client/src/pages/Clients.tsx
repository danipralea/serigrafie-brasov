import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, hasTeamAccess, isRegularUser as isRegularUserRole } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, getDocs, addDoc, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import AppShell from '../components/AppShell';
import AddClientModal from '../components/AddClientModal';
import EditClientModal from '../components/EditClientModal';
import InviteClientModal from '../components/InviteClientModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDate } from '../utils/dateUtils';
import { showError, showSuccess } from '../services/notificationService';

export default function Clients() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [clients, setClients] = useState<any[]>([]);
  const [filteredClients, setFilteredClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [userAccounts, setUserAccounts] = useState<Map<string, { email: string; provider: string; displayName: string; photoURL?: string; isRegularUser: boolean }>>(new Map());

  useEffect(() => {
    // Only team members can access this page (owner, admin, member)
    if (!hasTeamAccess(userProfile)) {
      navigate('/dashboard');
      return;
    }
    fetchClients();
    fetchUserAccounts();
  }, [currentUser, userProfile, navigate]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [clients, searchQuery, sortBy]);

  async function fetchClients() {
    try {
      setLoading(true);
      const clientsRef = collection(db, 'clients');
      const q = query(clientsRef);
      const snapshot = await getDocs(q);
      const clientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClients(clientsData);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching clients:', error);
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchUserAccounts() {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const accounts = new Map<string, { email: string; provider: string; displayName: string; photoURL?: string; isRegularUser: boolean }>();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const email = data.email;
        if (email) {
          const isRegularUser = data.role === 'user';
          accounts.set(email.toLowerCase(), {
            email: email,
            provider: data.authProvider || 'password',
            displayName: data.displayName || email,
            photoURL: data.photoURL,
            isRegularUser
          });
        }
      });
      setUserAccounts(accounts);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching user accounts:', error);
      }
    }
  }

  function applyFiltersAndSort() {
    // Merge clients with regular users who don't have client records
    let allClients = [...clients];

    // Add regular users who aren't in the clients list
    userAccounts.forEach((userData, email) => {
      if (userData.isRegularUser) {
        // Check if this user already exists as a client
        const existsAsClient = clients.some(c => c.email && c.email.toLowerCase() === email);
        if (!existsAsClient) {
          // Create a virtual client from the user account
          allClients.push({
            id: `user-${email}`,
            name: userData.displayName,
            email: userData.email,
            phone: null,
            company: null,
            address: null,
            notes: null,
            createdAt: { toMillis: () => Date.now() }, // We don't have the real date
            isVirtualClient: true // Mark as virtual so we know it's from users collection
          });
        }
      }
    });

    let filtered = allClients;

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(client =>
        client.name?.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.phone?.toLowerCase().includes(query) ||
        client.company?.toLowerCase().includes(query)
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
      case 'name-asc':
        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'name-desc':
        filtered.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        break;
      default:
        break;
    }

    setFilteredClients(filtered);
  }

  function openEditModal(client) {
    setSelectedClient(client);
    setShowEditModal(true);
  }

  function promptDeleteClient(clientId) {
    setSelectedClientId(clientId);
    setShowDeleteDialog(true);
  }

  async function handleDeleteClient() {
    if (!selectedClientId) return;

    try {
      const clientRef = doc(db, 'clients', selectedClientId);
      await deleteDoc(clientRef);
      await fetchClients();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error deleting client:', error);
      }
      showError(t('clients.deleteError'));
    } finally {
      setShowDeleteDialog(false);
      setSelectedClientId(null);
    }
  }

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  function clientHasAccount(client) {
    return client.email && userAccounts.has(client.email.toLowerCase());
  }

  function getClientProvider(client) {
    if (!client.email) return null;
    const account = userAccounts.get(client.email.toLowerCase());
    return account?.provider || null;
  }

  function renderProviderIcon(provider) {
    if (!provider) return null;

    if (provider === 'google.com') {
      return (
        <svg className="w-3 h-3" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      );
    }

    if (provider === 'password') {
      return (
        <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    }

    if (provider === 'phone') {
      return (
        <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      );
    }

    return null;
  }

  function getProviderTooltip(provider) {
    if (provider === 'google.com') {
      return t('clients.hasAccount') + ' (Google)';
    }
    if (provider === 'password') {
      return t('clients.hasAccount') + ' (Email)';
    }
    if (provider === 'phone') {
      return t('clients.hasAccount') + ' (Phone)';
    }
    return t('clients.hasAccount');
  }

  return (
    <AppShell title={t('clients.title')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8 gap-2">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{t('clients.title')}</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-3 sm:px-4 py-2 rounded-lg bg-white dark:bg-slate-700 border-2 border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 font-medium transition-colors hover:bg-blue-50 dark:hover:bg-slate-600 flex items-center gap-2 focus:outline-none shrink-0"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="whitespace-nowrap text-sm sm:text-base">{t('clients.inviteClient')}</span>
            </button>
            <button
              data-testid="clients-add-client-button"
              onClick={() => setShowAddModal(true)}
              className="px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium transition-opacity hover:opacity-90 flex items-center gap-2 focus:outline-none shrink-0"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="whitespace-nowrap text-sm sm:text-base">{t('clients.addClient')}</span>
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 mb-6 border border-slate-200 dark:border-slate-700 transition-colors">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('clients.search')}
              </label>
              <input
                type="text"
                placeholder={t('clients.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('clients.sortBy')}
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <option value="date-desc">{t('clients.dateNewest')}</option>
                <option value="date-asc">{t('clients.dateOldest')}</option>
                <option value="name-asc">{t('clients.nameAZ')}</option>
                <option value="name-desc">{t('clients.nameZA')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Clients Grid */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('clients.allClients')} ({filteredClients.length})
            </h3>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
            </div>
          ) : filteredClients.length === 0 ? (
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
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                {t('clients.noClients')}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {clients.length === 0 ? t('clients.noClientsDesc') : t('clients.adjustFilters')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                  onClick={() => openEditModal(client)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                        {getInitials(client.name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-900 dark:text-white">
                            {client.name}
                          </h4>
                          {clientHasAccount(client) && (
                            <div
                              className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700"
                              title={getProviderTooltip(getClientProvider(client))}
                            >
                              {renderProviderIcon(getClientProvider(client))}
                            </div>
                          )}
                        </div>
                        {client.company && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {client.company}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        promptDeleteClient(client.id);
                      }}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 rounded transition-colors"
                      title={t('clients.deleteClient')}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-2 text-sm">
                    {client.email && (
                      <div className="flex items-center text-slate-600 dark:text-slate-400">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center text-slate-600 dark:text-slate-400">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>{client.phone}</span>
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-start text-slate-600 dark:text-slate-400">
                        <svg className="w-4 h-4 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="flex-1">{client.address}</span>
                      </div>
                    )}
                    <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t('clients.added')} {formatDate(client.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {/* Invite Client Modal */}
      <InviteClientModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />

      {/* Add Client Modal */}
      <AddClientModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onClientAdded={fetchClients}
      />

      {/* Edit Client Modal */}
      <EditClientModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedClient(null);
        }}
        onClientUpdated={fetchClients}
        client={selectedClient}
      />

      {/* Delete Client Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedClientId(null);
        }}
        onConfirm={handleDeleteClient}
        title={t('clients.deleteDialog.title')}
        message={t('clients.deleteDialog.message')}
        confirmText={t('clients.deleteDialog.confirm')}
        cancelText={t('clients.deleteDialog.cancel')}
        type="danger"
      />
      </div>
    </AppShell>
  );
}
