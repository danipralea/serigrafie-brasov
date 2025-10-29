import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

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
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.language-dropdown') && !target.closest('.theme-dropdown') && !target.closest('.user-menu')) {
        setLangMenuOpen(false);
        setThemeMenuOpen(false);
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const changeTheme = (mode: 'light' | 'dark' | 'system') => {
    setThemeMode(mode);
    setThemeMenuOpen(false);
  };

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setLangMenuOpen(false);
  };

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
                  <>
                    <button
                      onClick={() => navigate('/clients')}
                      className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 rounded-lg transition-all hover:shadow-md"
                    >
                      {t('nav.clients')}
                    </button>
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
              </>
            )}

            {/* Language Switcher */}
            <div className="relative language-dropdown">
              <button
                onClick={() => {
                  setLangMenuOpen(!langMenuOpen);
                  setThemeMenuOpen(false);
                  setUserMenuOpen(false);
                }}
                className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 rounded-lg transition-all hover:shadow-md flex items-center"
                aria-label="Select language"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              </button>

              {langMenuOpen && (
                <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden">
                  <button
                    onClick={() => changeLanguage('ro')}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                      i18n.language === 'ro'
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    Română
                  </button>
                  <button
                    onClick={() => changeLanguage('en')}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                      i18n.language === 'en'
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    English
                  </button>
                </div>
              )}
            </div>

            {/* Theme Selector */}
            <div className="relative theme-dropdown">
              <button
                onClick={() => {
                  setThemeMenuOpen(!themeMenuOpen);
                  setLangMenuOpen(false);
                  setUserMenuOpen(false);
                }}
                className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 rounded-lg transition-all hover:shadow-md flex items-center gap-2"
                aria-label="Select theme"
              >
                {themeMode === 'light' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : themeMode === 'dark' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {themeMenuOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden">
                  <button
                    onClick={() => changeTheme('light')}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
                      themeMode === 'light'
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Luminos
                  </button>
                  <button
                    onClick={() => changeTheme('dark')}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
                      themeMode === 'dark'
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    Întunecat
                  </button>
                  <button
                    onClick={() => changeTheme('system')}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
                      themeMode === 'system'
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Sistem
                  </button>
                </div>
              )}
            </div>

            {/* User Menu (only for authenticated variant) */}
            {variant === 'authenticated' && currentUser && (
              <div className="relative user-menu">
                <button
                  onClick={() => {
                    setUserMenuOpen(!userMenuOpen);
                    setLangMenuOpen(false);
                    setThemeMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  {/* Profile Picture or Initials */}
                  {userProfile?.photoURL ? (
                    <img
                      src={userProfile.photoURL}
                      alt="Profile"
                      className="w-8 h-8 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold border-2 border-slate-200 dark:border-slate-600">
                      {getInitials(userProfile?.displayName || currentUser.displayName, currentUser.email)}
                    </div>
                  )}
                  <span>{userProfile?.displayName || currentUser.displayName || currentUser.email}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden">
                    <button
                      onClick={() => {
                        navigate('/profile');
                        setUserMenuOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      {t('nav.profile')}
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      {t('nav.signOut')}
                    </button>
                  </div>
                )}
              </div>
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
