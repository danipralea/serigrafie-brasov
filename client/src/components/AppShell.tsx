import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Disclosure, DisclosureButton, DisclosurePanel, Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import { Bars3Icon, XMarkIcon, GlobeAltIcon, SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { XMarkIcon as XMarkIconSolid } from '@heroicons/react/20/solid';
import { db } from '../firebase';
import { collection, query, orderBy as firestoreOrderBy, onSnapshot, limit } from 'firebase/firestore';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function AppShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { currentUser, userProfile, logout } = useAuth();
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('themeMode');
    return (saved as 'light' | 'dark' | 'system') || 'system';
  });
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationOrderId, setNotificationOrderId] = useState('');

  // Apply dark mode based on theme preference
  useEffect(() => {
    localStorage.setItem('themeMode', themeMode);

    const applyTheme = () => {
      const html = document.documentElement;

      if (themeMode === 'dark') {
        html.classList.add('dark');
      } else if (themeMode === 'light') {
        html.classList.remove('dark');
      } else {
        // System preference
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
          html.classList.add('dark');
        } else {
          html.classList.remove('dark');
        }
      }
    };

    applyTheme();

    // Listen for system theme changes when in system mode
    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode]);

  // Listen for new orders and show toast
  useEffect(() => {
    if (!currentUser || !userProfile) {
      return;
    }

    // Only for admins and team members
    if (!userProfile.isAdmin && !userProfile.isTeamMember) {
      return;
    }

    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      firestoreOrderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const order = change.doc.data();
          const orderAge = Date.now() - order.createdAt?.toMillis();
          // Only show notification for orders created in the last 10 seconds (to avoid showing old ones on page load)
          if (orderAge < 10000) {
            const message = `${order.userName || order.userEmail} a plasat comanda #${change.doc.id.substring(0, 8).toUpperCase()}`;
            const orderId = change.doc.id;

            // Play notification sound
            try {
              const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();

              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);

              oscillator.frequency.value = 800;
              oscillator.type = 'sine';

              gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

              oscillator.start(audioContext.currentTime);
              oscillator.stop(audioContext.currentTime + 0.5);
            } catch (error) {
              console.error('Error playing notification sound:', error);
            }

            setNotificationMessage(message);
            setNotificationOrderId(orderId);
            setShowNotification(true);
            // Auto-hide after 6 seconds
            setTimeout(() => setShowNotification(false), 6000);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [currentUser, userProfile]);

  const navigation = [
    { name: t('nav.orders'), href: '/dashboard', current: location.pathname === '/dashboard' },
    ...(userProfile?.isAdmin || userProfile?.isTeamMember
      ? [
          { name: t('nav.clients'), href: '/clients', current: location.pathname === '/clients' },
        ]
      : []),
    ...(userProfile?.isAdmin
      ? [
          { name: t('nav.team'), href: '/team', current: location.pathname === '/team' },
        ]
      : []),
  ];

  const userNavigation = [
    { name: t('nav.profile'), onClick: () => navigate('/profile') },
    { name: t('nav.signOut'), onClick: async () => {
      await logout();
      navigate('/login');
    }},
  ];

  function getInitials(name: string | null | undefined, email: string | null | undefined) {
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

  const themeIcons = {
    light: SunIcon,
    dark: MoonIcon,
    system: ComputerDesktopIcon,
  };

  const themeLabels = {
    light: 'Luminos',
    dark: 'Întunecat',
    system: 'Sistem',
  };

  const ThemeIcon = themeIcons[themeMode];

  return (
    <div className="min-h-full">
      <Disclosure as="nav" className="bg-slate-800 dark:bg-slate-900/95 border-b border-slate-700 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <div className="shrink-0">
                <h1
                  onClick={() => navigate('/dashboard')}
                  className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity"
                >
                  {t('landing.title')}
                </h1>
              </div>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  {navigation.map((item) => (
                    <a
                      key={item.name}
                      onClick={() => navigate(item.href)}
                      aria-current={item.current ? 'page' : undefined}
                      className={classNames(
                        item.current
                          ? 'bg-slate-900 text-white dark:bg-slate-950/50'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white',
                        'rounded-md px-3 py-2 text-sm font-medium cursor-pointer transition-colors',
                      )}
                    >
                      {item.name}
                    </a>
                  ))}
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="ml-4 flex items-center md:ml-6 gap-2">
                {/* Language Menu */}
                <Menu as="div" className="relative">
                  <MenuButton className="relative rounded-full p-2 text-slate-400 hover:text-white focus:outline-none transition-colors">
                    <span className="sr-only">Select language</span>
                    <GlobeAltIcon aria-hidden="true" className="size-5" />
                  </MenuButton>
                  <MenuItems
                    transition
                    className="absolute right-0 z-10 mt-2 w-36 origin-top-right rounded-md bg-white py-1 shadow-lg outline-1 outline-black/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in dark:bg-slate-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
                  >
                    <MenuItem>
                      <button
                        onClick={() => i18n.changeLanguage('ro')}
                        className={classNames(
                          i18n.language === 'ro'
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-300',
                          'w-full text-left px-4 py-2 text-sm data-focus:bg-slate-100 data-focus:outline-hidden dark:data-focus:bg-white/5 transition-colors'
                        )}
                      >
                        Română
                      </button>
                    </MenuItem>
                    <MenuItem>
                      <button
                        onClick={() => i18n.changeLanguage('en')}
                        className={classNames(
                          i18n.language === 'en'
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-300',
                          'w-full text-left px-4 py-2 text-sm data-focus:bg-slate-100 data-focus:outline-hidden dark:data-focus:bg-white/5 transition-colors'
                        )}
                      >
                        English
                      </button>
                    </MenuItem>
                  </MenuItems>
                </Menu>

                {/* Theme Menu */}
                <Menu as="div" className="relative">
                  <MenuButton className="relative rounded-full p-2 text-slate-400 hover:text-white focus:outline-none transition-colors">
                    <span className="sr-only">Select theme</span>
                    <ThemeIcon aria-hidden="true" className="size-5" />
                  </MenuButton>
                  <MenuItems
                    transition
                    className="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-md bg-white py-1 shadow-lg outline-1 outline-black/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in dark:bg-slate-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
                  >
                    {(['light', 'dark', 'system'] as const).map((theme) => {
                      const Icon = themeIcons[theme];
                      return (
                        <MenuItem key={theme}>
                          <button
                            onClick={() => setThemeMode(theme)}
                            className={classNames(
                              themeMode === theme
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                                : 'text-slate-700 dark:text-slate-300',
                              'w-full text-left px-4 py-2 text-sm data-focus:bg-slate-100 data-focus:outline-hidden dark:data-focus:bg-white/5 transition-colors flex items-center gap-2'
                            )}
                          >
                            <Icon className="size-4" />
                            {themeLabels[theme]}
                          </button>
                        </MenuItem>
                      );
                    })}
                  </MenuItems>
                </Menu>

                {/* Profile dropdown */}
                <Menu as="div" className="relative ml-1">
                  <MenuButton className="relative flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/5 focus:outline-none transition-colors">
                    <span className="sr-only">Open user menu</span>
                    {userProfile?.photoURL ? (
                      <img
                        alt="Profile"
                        src={userProfile.photoURL}
                        className="size-8 rounded-full outline -outline-offset-1 outline-white/10 object-cover"
                      />
                    ) : (
                      <div className="size-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold outline -outline-offset-1 outline-white/10">
                        {getInitials(userProfile?.displayName || currentUser?.displayName, currentUser?.email)}
                      </div>
                    )}
                    <span className="text-sm font-medium text-slate-300 hidden sm:block">
                      {userProfile?.displayName || currentUser?.displayName || currentUser?.email?.split('@')[0]}
                    </span>
                  </MenuButton>

                  <MenuItems
                    transition
                    className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg outline-1 outline-black/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in dark:bg-slate-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
                  >
                    {userNavigation.map((item) => (
                      <MenuItem key={item.name}>
                        <button
                          onClick={item.onClick}
                          className="w-full text-left block px-4 py-2 text-sm text-slate-700 data-focus:bg-slate-100 data-focus:outline-hidden dark:text-slate-300 dark:data-focus:bg-white/5 transition-colors"
                        >
                          {item.name}
                        </button>
                      </MenuItem>
                    ))}
                  </MenuItems>
                </Menu>
              </div>
            </div>
            <div className="-mr-2 flex md:hidden">
              {/* Mobile menu button */}
              <DisclosureButton className="group relative inline-flex items-center justify-center rounded-md p-2 text-slate-400 hover:bg-white/5 hover:text-white focus:outline-2 focus:outline-offset-2 focus:outline-blue-500 transition-colors">
                <span className="absolute -inset-0.5" />
                <span className="sr-only">Open main menu</span>
                <Bars3Icon aria-hidden="true" className="block size-6 group-data-open:hidden" />
                <XMarkIcon aria-hidden="true" className="hidden size-6 group-data-open:block" />
              </DisclosureButton>
            </div>
          </div>
        </div>

        <DisclosurePanel className="md:hidden">
          <div className="space-y-1 px-2 pt-2 pb-3 sm:px-3">
            {navigation.map((item) => (
              <DisclosureButton
                key={item.name}
                as="button"
                onClick={() => navigate(item.href)}
                aria-current={item.current ? 'page' : undefined}
                className={classNames(
                  item.current
                    ? 'bg-slate-900 text-white dark:bg-slate-950/50'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white',
                  'w-full text-left block rounded-md px-3 py-2 text-base font-medium transition-colors',
                )}
              >
                {item.name}
              </DisclosureButton>
            ))}
          </div>
          <div className="border-t border-white/10 pt-4 pb-3">
            <div className="flex items-center px-5">
              <div className="shrink-0">
                {userProfile?.photoURL ? (
                  <img
                    alt="Profile"
                    src={userProfile.photoURL}
                    className="size-10 rounded-full outline -outline-offset-1 outline-white/10 object-cover"
                  />
                ) : (
                  <div className="size-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold outline -outline-offset-1 outline-white/10">
                    {getInitials(userProfile?.displayName || currentUser?.displayName, currentUser?.email)}
                  </div>
                )}
              </div>
              <div className="ml-3">
                <div className="text-base/5 font-medium text-white">
                  {userProfile?.displayName || currentUser?.displayName || currentUser?.email}
                </div>
                <div className="text-sm font-medium text-slate-400">{currentUser?.email}</div>
              </div>
            </div>
            <div className="mt-3 space-y-1 px-2">
              {userNavigation.map((item) => (
                <DisclosureButton
                  key={item.name}
                  as="button"
                  onClick={item.onClick}
                  className="w-full text-left block rounded-md px-3 py-2 text-base font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                >
                  {item.name}
                </DisclosureButton>
              ))}
            </div>
          </div>
        </DisclosurePanel>
      </Disclosure>

      <main className="bg-slate-50 dark:bg-slate-900 min-h-[calc(100vh-4rem)] transition-colors">
        {children}
      </main>

      {/* Global notification live region */}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:items-start sm:p-6 z-50"
      >
        <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
          <Transition show={showNotification}>
            <div className="pointer-events-auto w-full max-w-sm rounded-lg bg-white shadow-lg outline-1 outline-black/5 transition data-closed:opacity-0 data-enter:transform data-enter:duration-300 data-enter:ease-out data-closed:data-enter:translate-y-2 data-leave:duration-100 data-leave:ease-in data-closed:data-enter:sm:translate-x-2 data-closed:data-enter:sm:translate-y-0 dark:bg-slate-800 dark:-outline-offset-1 dark:outline-white/10">
              <div className="p-4">
                <div className="flex items-start">
                  <div className="shrink-0">
                    <svg className="size-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="ml-3 w-0 flex-1 pt-0.5">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Comandă nouă</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                      {notificationMessage}
                    </p>
                    <div className="mt-3 flex space-x-7">
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotification(false);
                          navigate('/dashboard', { state: { openOrderId: notificationOrderId } });
                        }}
                        className="rounded-md text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500 dark:text-blue-400 dark:hover:text-blue-300 dark:focus:outline-blue-400"
                      >
                        {t('common.showDetails')}
                      </button>
                    </div>
                  </div>
                  <div className="ml-4 flex shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowNotification(false)}
                      className="inline-flex rounded-md text-gray-400 hover:text-gray-500 focus:outline-2 focus:outline-offset-2 focus:outline-blue-600 dark:hover:text-white dark:focus:outline-blue-500"
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIconSolid aria-hidden="true" className="size-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  );
}
