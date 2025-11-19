import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { GlobeAltIcon, SunIcon, MoonIcon, ComputerDesktopIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface NavigationProps {
  variant?: 'landing' | 'authenticated';
  onInviteTeam?: () => void;
}

export default function Navigation({ variant = 'landing', onInviteTeam }: NavigationProps) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { currentUser, userProfile, logout } = useAuth();
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('themeMode');
    return (saved as 'light' | 'dark' | 'system') || 'system';
  });

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

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  return (
    <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <h1
            onClick={() => navigate(currentUser ? '/dashboard' : '/')}
            className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity"
          >
            {t('landing.title')}
          </h1>

          <div className="flex items-center gap-3">
            {/* Authenticated Navigation Items */}
            {variant === 'authenticated' && currentUser && (
              <>
                {/* Show Place Order button for all users (clients and team members) */}
                <button
                  onClick={() => navigate('/place-order')}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg shadow-sm hover:opacity-90 transition-opacity"
                >
                  {t('nav.placeOrder')}
                </button>
                {(userProfile?.isAdmin || userProfile?.isTeamMember) && (
                  <button
                    onClick={() => navigate('/clients')}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 rounded-lg transition-all hover:shadow-md"
                  >
                    {t('nav.clients')}
                  </button>
                )}
                {(userProfile?.isAdmin || userProfile?.isTeamMember) && (
                  <button
                    onClick={() => navigate('/suppliers')}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 rounded-lg transition-all hover:shadow-md"
                  >
                    {t('nav.suppliers')}
                  </button>
                )}
                {userProfile?.isAdmin && (
                  <button
                    onClick={() => navigate('/team')}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 rounded-lg transition-all hover:shadow-md"
                  >
                    {t('nav.team')}
                  </button>
                )}
              </>
            )}

            {/* Language Switcher */}
            <Menu as="div" className="relative inline-block">
              <MenuButton className="flex items-center px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 rounded-lg transition-all hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-500">
                <span className="sr-only">Select language</span>
                <GlobeAltIcon aria-hidden="true" className="size-5" />
              </MenuButton>
              <MenuItems
                transition
                className="absolute right-0 z-10 mt-2 w-36 origin-top-right rounded-md bg-white shadow-lg outline-1 outline-black/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in dark:bg-slate-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
              >
                <div className="py-1">
                  <MenuItem>
                    <button
                      onClick={() => i18n.changeLanguage('ro')}
                      className={`w-full text-left block px-4 py-2 text-sm data-focus:bg-slate-100 data-focus:text-slate-900 data-focus:outline-hidden dark:data-focus:bg-white/5 dark:data-focus:text-white ${
                        i18n.language === 'ro'
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Română
                    </button>
                  </MenuItem>
                  <MenuItem>
                    <button
                      onClick={() => i18n.changeLanguage('en')}
                      className={`w-full text-left block px-4 py-2 text-sm data-focus:bg-slate-100 data-focus:text-slate-900 data-focus:outline-hidden dark:data-focus:bg-white/5 dark:data-focus:text-white ${
                        i18n.language === 'en'
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      English
                    </button>
                  </MenuItem>
                </div>
              </MenuItems>
            </Menu>

            {/* Theme Selector */}
            <Menu as="div" className="relative inline-block">
              <MenuButton className="flex items-center px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 rounded-lg transition-all hover:shadow-md gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-500">
                <span className="sr-only">Select theme</span>
                <ThemeIcon aria-hidden="true" className="size-5" />
                <ChevronDownIcon aria-hidden="true" className="size-4" />
              </MenuButton>
              <MenuItems
                transition
                className="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-md bg-white shadow-lg outline-1 outline-black/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in dark:bg-slate-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
              >
                <div className="py-1">
                  {(['light', 'dark', 'system'] as const).map((theme) => {
                    const Icon = themeIcons[theme];
                    return (
                      <MenuItem key={theme}>
                        <button
                          onClick={() => setThemeMode(theme)}
                          className={`w-full text-left block px-4 py-2 text-sm data-focus:bg-slate-100 data-focus:text-slate-900 data-focus:outline-hidden dark:data-focus:bg-white/5 dark:data-focus:text-white flex items-center gap-2 ${
                            themeMode === theme
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <Icon className="size-4" />
                          {themeLabels[theme]}
                        </button>
                      </MenuItem>
                    );
                  })}
                </div>
              </MenuItems>
            </Menu>

            {/* User Menu (only for authenticated variant) */}
            {variant === 'authenticated' && currentUser && (
              <Menu as="div" className="relative inline-block">
                <MenuButton className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-500">
                  <span className="sr-only">Open user menu</span>
                  {/* Profile Picture or Initials */}
                  {userProfile?.photoURL ? (
                    <img
                      src={userProfile.photoURL}
                      alt="Profile"
                      className="size-8 rounded-full object-cover outline -outline-offset-1 outline-slate-200 dark:outline-slate-600"
                    />
                  ) : (
                    <div className="size-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold outline -outline-offset-1 outline-slate-200 dark:outline-slate-600">
                      {getInitials(userProfile?.displayName || currentUser.displayName, currentUser.email)}
                    </div>
                  )}
                  <span>{userProfile?.displayName || currentUser.displayName || currentUser.email}</span>
                  <ChevronDownIcon aria-hidden="true" className="size-4" />
                </MenuButton>

                <MenuItems
                  transition
                  className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg outline-1 outline-black/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in dark:bg-slate-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
                >
                  <div className="py-1">
                    <MenuItem>
                      <button
                        onClick={() => navigate('/profile')}
                        className="w-full text-left block px-4 py-2 text-sm text-slate-700 data-focus:bg-slate-100 data-focus:text-slate-900 data-focus:outline-hidden dark:text-slate-300 dark:data-focus:bg-white/5 dark:data-focus:text-white"
                      >
                        {t('nav.profile')}
                      </button>
                    </MenuItem>
                    <MenuItem>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left block px-4 py-2 text-sm text-slate-700 data-focus:bg-slate-100 data-focus:text-slate-900 data-focus:outline-hidden dark:text-slate-300 dark:data-focus:bg-white/5 dark:data-focus:text-white"
                      >
                        {t('nav.signOut')}
                      </button>
                    </MenuItem>
                  </div>
                </MenuItems>
              </Menu>
            )}

            {/* Login Button (only for landing variant) */}
            {variant === 'landing' && !currentUser && (
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 rounded-lg transition-all hover:shadow-md"
              >
                {t('landing.login')}
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
