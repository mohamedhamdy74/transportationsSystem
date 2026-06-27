import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  MapPin,
  Inbox,
  FileSpreadsheet,
  Calendar,
  Car,
  ClipboardList,
  LogOut,
  Globe,
  Menu,
  X
} from 'lucide-react';

const iconMap = {
  grid: <LayoutDashboard className="w-5 h-5" />,
  'map-pin': <MapPin className="w-5 h-5" />,
  inbox: <Inbox className="w-5 h-5" />,
  'file-spreadsheet': <FileSpreadsheet className="w-5 h-5" />,
  calendar: <Calendar className="w-5 h-5" />,
  car: <Car className="w-5 h-5" />,
  'clipboard-list': <ClipboardList className="w-5 h-5" />,
};

const roleColors = {
  admin: 'from-indigo-600 to-indigo-800',
  company: 'from-emerald-600 to-emerald-800',
  inspector: 'from-amber-500 to-amber-700',
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = {
    admin: [
      { path: '/admin', label: t('nav.dashboard'), icon: 'grid' },
      { path: '/admin/gps', label: t('nav.gps'), icon: 'map-pin' },
      { path: '/admin/requests', label: t('admin.tabs.requests'), icon: 'inbox' },
      { path: '/admin/excel', label: t('nav.excel'), icon: 'file-spreadsheet' },
    ],
    company: [
      { path: '/company', label: t('nav.dashboard'), icon: 'grid' },
      { path: '/company/daily-plan', label: t('company.tabs.daily'), icon: 'calendar' },
      { path: '/company/fleet', label: t('company.stats.vehicles'), icon: 'car' },
      { path: '/company/excel', label: t('nav.excel'), icon: 'file-spreadsheet' },
    ],
    inspector: [
      { path: '/inspector', label: t('nav.dashboard'), icon: 'grid' },
      { path: '/inspector/register', label: t('admin.tabs.inspections'), icon: 'clipboard-list' },
      { path: '/inspector/excel', label: t('nav.excel'), icon: 'file-spreadsheet' },
    ]
  };

  const roleLabels = {
    admin: t('nav.admin'),
    company: t('nav.company'),
    inspector: t('nav.inspector'),
  };

  const items = navItems[user?.role] || [];
  const gradientClass = roleColors[user?.role] || 'from-indigo-600 to-indigo-800';
  const roleLabel = roleLabels[user?.role] || '';
  const isRtl = i18n.language === 'ar';

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');
  };

  const sidebarContent = (
    <>
      <div className={`bg-gradient-to-br ${gradientClass} p-5 flex-shrink-0 shadow-inner`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm shrink-0">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-none">Fleet MS</p>
              <p className="text-white/80 text-xs mt-0.5 truncate">{t('app_title')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-white/90 hover:text-white p-1"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="bg-white/10 rounded-xl px-3 py-2 backdrop-blur-sm border border-white/10">
          <p className="text-white/80 text-xs">{roleLabel}</p>
          <p className="text-white font-semibold text-sm truncate">{user?.company || user?.username}</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              {iconMap[item.icon]}
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-100 flex-shrink-0 space-y-1">
        <button
          type="button"
          onClick={toggleLanguage}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
        >
          <Globe className="w-5 h-5" />
          {isRtl ? 'English' : 'العربية'}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-all"
        >
          <LogOut className="w-5 h-5" />
          {t('nav.logout')}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-cairo overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu overlay"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 z-30 w-64 max-w-[85vw] flex-shrink-0 bg-white border-gray-200 flex flex-col h-full shadow-lg md:shadow-sm transition-transform duration-300 ${
          isRtl ? 'right-0 border-l' : 'left-0 border-r'
        } ${
          sidebarOpen
            ? 'translate-x-0'
            : isRtl
              ? 'translate-x-full md:translate-x-0'
              : '-translate-x-full md:translate-x-0'
        }`}
      >
        {sidebarContent}
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto flex flex-col">
        <header className="h-14 md:h-16 flex-shrink-0 border-b border-gray-200 bg-white/80 backdrop-blur-md px-3 md:px-6 flex items-center justify-between sticky top-0 z-10 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 shrink-0"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-gray-800 font-bold text-base md:text-lg truncate">
                {items.find(i => i.path === location.pathname)?.label || t('app_title')}
              </h2>
              <p className="text-gray-500 text-xs hidden sm:block">
                {new Date().toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
          <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white text-sm font-bold shadow-md shrink-0`}>
            {(user?.company || user?.username || 'U').charAt(0).toUpperCase()}
          </div>
        </header>

        <div className="flex-1 p-3 sm:p-4 md:p-6 animate-fade-in bg-gray-50">
          {children}
        </div>
      </main>
    </div>
  );
}
