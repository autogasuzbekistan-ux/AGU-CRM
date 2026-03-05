import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserPlus, BarChart3, MessageSquare,
  CheckSquare, Package, Settings, LogOut, Bell, Menu, X,
  TrendingUp, Trophy, Zap, ChevronDown, Building2,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotifications } from '../hooks/useNotifications';
import { useSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/contacts', label: 'Mijozlar', icon: Users },
  { to: '/leads', label: 'Leadlar', icon: UserPlus },
  { to: '/deals', label: 'Bitimlar', icon: TrendingUp },
  { to: '/conversations', label: 'Suhbatlar', icon: MessageSquare, badge: 'unread' },
  { to: '/tasks', label: 'Vazifalar', icon: CheckSquare },
  { to: '/warehouse', label: 'Ombor', icon: Package },
  { divider: true },
  { to: '/analytics', label: 'Tahlil', icon: BarChart3 },
  { to: '/leaderboard', label: 'Reyting', icon: Trophy },
  { divider: true },
  { to: '/settings/integrations', label: 'Integratsiyalar', icon: Zap },
  { to: '/settings/users', label: 'Foydalanuvchilar', icon: Users, adminOnly: true },
  { to: '/settings', label: 'Sozlamalar', icon: Settings },
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();

  // Socket.IO ulanish
  useSocket();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    toast.success('Muvaffaqiyatli chiqdingiz');
  };

  const filteredNav = navItems.filter(
    (item) => !item.adminOnly || ['admin', 'manager'].includes(user?.role)
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100">
        <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-lg">A</span>
        </div>
        {sidebarOpen && (
          <div>
            <span className="font-bold text-gray-900">AGU CRM</span>
            <p className="text-xs text-gray-400 truncate max-w-[120px]">{user?.organizationName}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {filteredNav.map((item, idx) => {
          if (item.divider) {
            return <div key={idx} className="my-2 border-t border-gray-100" />;
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <item.icon size={18} className="shrink-0" />
              {sidebarOpen && (
                <span className="flex-1 truncate">{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User info */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
            <span className="text-primary-700 font-semibold text-sm">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
          )}
          {sidebarOpen && (
            <button onClick={handleLogout} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col bg-white border-r border-gray-100 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'}`}>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-white h-full shadow-xl z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSidebarOpen(!sidebarOpen); setMobileOpen(!mobileOpen); }}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            >
              <Menu size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Bildirishnomalar */}
            <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Tashkilot */}
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 text-sm text-gray-600">
              <Building2 size={16} />
              <span className="hidden sm:block max-w-[120px] truncate">{user?.organizationName}</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
