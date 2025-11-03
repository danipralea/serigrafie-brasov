import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { collection, query, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
}

interface ClientAutocompleteProps {
  selectedClient: Client | null;
  onSelectClient: (client: Client | null) => void;
  error?: string;
}

export default function ClientAutocomplete({ selectedClient, onSelectClient, error }: ClientAutocompleteProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // New client form state
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    notes: ''
  });

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    // Filter clients based on search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const filtered = clients.filter(client =>
        client.name?.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.phone?.toLowerCase().includes(query) ||
        client.company?.toLowerCase().includes(query)
      );
      setFilteredClients(filtered);
      setShowDropdown(true);
    } else {
      setFilteredClients([]);
      setShowDropdown(false);
    }
  }, [searchQuery, clients]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchClients() {
    try {
      const clientsRef = collection(db, 'clients');
      const snapshot = await getDocs(query(clientsRef));
      const clientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Client));
      setClients(clientsData);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  }

  function handleSelectClient(client: Client) {
    onSelectClient(client);
    setSearchQuery(client.name);
    setShowDropdown(false);
  }

  function handleClearSelection() {
    onSelectClient(null);
    setSearchQuery('');
    setShowDropdown(false);
  }

  async function handleAddNewClient(e: React.FormEvent) {
    e.preventDefault();

    if (!newClient.name.trim()) {
      alert(t('clients.addModal.errorName'));
      return;
    }

    if (newClient.email && !newClient.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      alert(t('clients.addModal.errorEmail'));
      return;
    }

    try {
      setLoading(true);
      const clientsRef = collection(db, 'clients');

      const clientDoc = await addDoc(clientsRef, {
        ...newClient,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      const addedClient: Client = {
        id: clientDoc.id,
        name: newClient.name,
        email: newClient.email,
        phone: newClient.phone,
        company: newClient.company
      };

      // Add to local state
      setClients([...clients, addedClient]);

      // Select the newly added client
      onSelectClient(addedClient);
      setSearchQuery(addedClient.name);

      // Reset form
      setNewClient({
        name: '',
        email: '',
        phone: '',
        company: '',
        address: '',
        notes: ''
      });
      setShowAddForm(false);
      setShowDropdown(false);
    } catch (error) {
      console.error('Error adding client:', error);
      alert(t('clients.addModal.errorFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery && setShowDropdown(true)}
          placeholder={t('order.clientPlaceholder')}
          className={`block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-base text-gray-900 dark:text-white outline-1 -outline-offset-1 ${
            error
              ? 'outline-red-500 dark:outline-red-500'
              : 'outline-gray-300 dark:outline-slate-600'
          } placeholder:text-gray-400 dark:placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors`}
        />
        {selectedClient && (
          <button
            type="button"
            onClick={handleClearSelection}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Dropdown with matching clients */}
      {showDropdown && filteredClients.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredClients.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => handleSelectClient(client)}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
            >
              <div className="font-medium text-gray-900 dark:text-white">{client.name}</div>
              {(client.company || client.email) && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {[client.company, client.email].filter(Boolean).join(' • ')}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center my-3">
        <div className="flex-1 border-t border-gray-300 dark:border-slate-600"></div>
        <span className="px-3 text-sm text-gray-500 dark:text-gray-400">{t('common.or')}</span>
        <div className="flex-1 border-t border-gray-300 dark:border-slate-600"></div>
      </div>

      {/* Add New Client Toggle */}
      <button
        type="button"
        onClick={() => setShowAddForm(!showAddForm)}
        className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
      >
        <span>{t('order.addNewClient')}</span>
        {showAddForm ? (
          <ChevronUpIcon className="w-5 h-5" />
        ) : (
          <ChevronDownIcon className="w-5 h-5" />
        )}
      </button>

      {/* Add New Client Form */}
      {showAddForm && (
        <div className="mt-3 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-md border border-gray-300 dark:border-slate-600">
          <form onSubmit={handleAddNewClient} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('clients.addModal.name')} *
              </label>
              <input
                type="text"
                value={newClient.name}
                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                placeholder={t('clients.addModal.namePlaceholder')}
                className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('clients.addModal.email')}
              </label>
              <input
                type="email"
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                placeholder={t('clients.addModal.emailPlaceholder')}
                className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('clients.addModal.phone')}
              </label>
              <input
                type="tel"
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                placeholder={t('clients.addModal.phonePlaceholder')}
                className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('clients.addModal.company')}
              </label>
              <input
                type="text"
                value={newClient.company}
                onChange={(e) => setNewClient({ ...newClient, company: e.target.value })}
                placeholder={t('clients.addModal.companyPlaceholder')}
                className="block w-full rounded-md bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-1 -outline-offset-1 outline-gray-300 dark:outline-slate-600 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 transition-colors"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewClient({
                    name: '',
                    email: '',
                    phone: '',
                    company: '',
                    address: '',
                    notes: ''
                  });
                }}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {loading ? t('clients.addModal.adding') : t('clients.addModal.add')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
