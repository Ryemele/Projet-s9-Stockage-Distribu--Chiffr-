import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  Home,
  Files,
  Share2,
  Users,
  User,
  Settings,
  LogOut,
  Folder,
  HardDrive,
  Shield,
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  badge?: number;
  adminOnly?: boolean;
}

const formatSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

// Context for mobile menu state
export const MobileMenuContext = React.createContext<{
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}>({
  isOpen: false,
  toggle: () => { },
  close: () => { },
});

export const useMobileMenu = () => React.useContext(MobileMenuContext);

export const MobileMenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <MobileMenuContext.Provider value={{
      isOpen,
      toggle: () => setIsOpen(!isOpen),
      close: () => setIsOpen(false),
    }}>
      {children}
    </MobileMenuContext.Provider>
  );
};

// Mobile Header with hamburger
export const MobileHeader: React.FC = () => {
  const { toggle } = useMobileMenu();

  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 flex items-center justify-between px-4">
      <Link to="/home" className="flex items-center gap-2">
        <img
          src="/Logo_VaultFlow.svg"
          alt="VaultFlow Logo"
          className="h-10 w-auto"
        />
        <span className="text-lg font-bold bg-gradient-to-r from-primary-600 to-secondary-400 bg-clip-text text-transparent">
          SecureBox
        </span>
      </Link>
      <button
        onClick={toggle}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Toggle menu"
      >
        <Menu className="h-6 w-6 text-gray-700" />
      </button>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isOpen, close } = useMobileMenu();
  const isAdmin = user?.role === 'admin';

  // Placeholder storage - in production this would come from API
  const usedStorage = 0;
  const totalStorage = 10 * 1024 * 1024 * 1024; // 10 GB limit
  const storagePercentage = (usedStorage / totalStorage) * 100;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
    close();
  };

  const handleNavClick = () => {
    close(); // Close mobile menu when navigating
  };

  const navItems: NavItem[] = [
    { name: "Home", path: "/home", icon: Home, adminOnly: false },
    { name: "My Files", path: "/files", icon: Files, adminOnly: false },
    { name: "Shared", path: "/shared", icon: Share2, badge: 0, adminOnly: false },
    { name: "Teams", path: "/teams", icon: Users, adminOnly: false },
    { name: "Folders", path: "/folders", icon: Folder, adminOnly: false },
    { name: "Admin Panel", path: "/admin", icon: Shield, adminOnly: true },
  ];

  // Filter items: admins see ONLY Admin Panel, users see everything except Admin Panel
  const filteredNavItems = navItems.filter(item =>
    isAdmin ? item.adminOnly === true : item.adminOnly === false
  );

  const bottomNavItems: NavItem[] = [
    { name: "Profile", path: "/profile", icon: User },
    { name: "Settings", path: "/settings", icon: Settings },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const sidebarContent = (
    <>
      {/* Logo Section - Hidden on mobile (shown in MobileHeader) */}
      <div className="h-16 hidden lg:flex items-center px-4 border-b border-gray-200">
        <Link to="/home" className="flex items-center gap-3" onClick={handleNavClick}>
          <img
            src="/Logo_VaultFlow.svg"
            alt="VaultFlow Logo"
            className="h-12 w-auto"
          />
          <div className="text-xl font-bold">
            <span className="bg-gradient-to-r from-primary-600 to-secondary-400 bg-clip-text text-transparent">
              Secure<span className="font-normal">Box</span>
            </span>
          </div>
        </Link>
      </div>

      {/* Mobile Close Button */}
      <div className="lg:hidden h-16 flex items-center justify-between px-4 border-b border-gray-200">
        <span className="text-lg font-bold bg-gradient-to-r from-primary-600 to-secondary-400 bg-clip-text text-transparent">
          Menu
        </span>
        <button
          onClick={close}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="h-6 w-6 text-gray-700" />
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={`
                flex items-center px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200 group relative
                ${active
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-700 hover:bg-gray-50"
                }
              `}
            >
              <Icon
                className={`
                  h-5 w-5 flex-shrink-0
                  ${active
                    ? "text-primary-600"
                    : "text-gray-500 group-hover:text-gray-700"
                  }
                `}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className="ml-3">{item.name}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto bg-primary-600 text-white text-xs rounded-full px-2 py-0.5">
                  {item.badge}
                </span>
              )}
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary-600 rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Storage Info - Hidden for admin users */}
      {!isAdmin && (
        <div className="px-3 py-3 border-t border-gray-200">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <HardDrive className="h-4 w-4 text-gray-600" />
                <span className="text-xs font-medium text-gray-700">Storage</span>
              </div>
              <span
                className={`text-xs font-medium ${storagePercentage > 90
                  ? "text-red-600"
                  : storagePercentage > 70
                    ? "text-yellow-600"
                    : "text-green-600"
                  }`}
              >
                {storagePercentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${storagePercentage > 90
                  ? "bg-red-500"
                  : storagePercentage > 70
                    ? "bg-yellow-500"
                    : "bg-gradient-to-r from-primary-500 to-secondary-400"
                  }`}
                style={{ width: `${Math.min(storagePercentage, 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {formatSize(usedStorage)} of {formatSize(totalStorage)} used
            </p>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="border-t border-gray-200">
        <nav className="px-3 py-3 space-y-1">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                className={`
                  flex items-center px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200 group
                  ${active
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-700 hover:bg-gray-50"
                  }
                `}
              >
                <Icon
                  className={`
                    h-5 w-5 flex-shrink-0
                    ${active
                      ? "text-primary-600"
                      : "text-gray-500 group-hover:text-gray-700"
                    }
                  `}
                />
                <span className="ml-3">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        {user && (
          <div className="px-3 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-secondary-400 flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="h-4 w-4 text-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex-shrink-0 p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 z-40 flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={close}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside
        className={`
          lg:hidden fixed left-0 top-0 h-screen w-72 bg-white z-50 flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
