import React from "react";
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
} from "lucide-react";
import { calculateTotalStorage, formatSize } from "../../mocks";

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  badge?: number;
}

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Calculate storage usage
  const usedStorage = calculateTotalStorage();
  const totalStorage = 10 * 1024 * 1024 * 1024; // 10 GB limit
  const storagePercentage = (usedStorage / totalStorage) * 100;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navItems: NavItem[] = [
    { name: "Home", path: "/home", icon: Home },
    { name: "My Files", path: "/files", icon: Files },
    { name: "Shared", path: "/shared", icon: Share2, badge: 0 },
    { name: "Teams", path: "/teams", icon: Users },
    { name: "Folders", path: "/folders", icon: Folder },
  ];

  const bottomNavItems: NavItem[] = [
    { name: "Profile", path: "/profile", icon: User },
    { name: "Settings", path: "/settings", icon: Settings },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 z-40 flex flex-col">
      {/* Logo Section */}
      <div className="h-16 flex items-center px-4 border-b border-gray-200">
        <Link to="/home" className="flex items-center gap-3">
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

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex items-center px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200 group relative
                ${
                  active
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-700 hover:bg-gray-50"
                }
              `}
            >
              <Icon
                className={`
                  h-5 w-5 flex-shrink-0
                  ${
                    active
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

      {/* Storage Info */}
      <div className="px-3 py-3 border-t border-gray-200">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <HardDrive className="h-4 w-4 text-gray-600" />
              <span className="text-xs font-medium text-gray-700">Storage</span>
            </div>
            <span
              className={`text-xs font-medium ${
                storagePercentage > 90
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
              className={`h-2 rounded-full transition-all duration-300 ${
                storagePercentage > 90
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
                className={`
                  flex items-center px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200 group
                  ${
                    active
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }
                `}
              >
                <Icon
                  className={`
                    h-5 w-5 flex-shrink-0
                    ${
                      active
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
    </aside>
  );
};
