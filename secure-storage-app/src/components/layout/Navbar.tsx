import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui";
import { Lock, User, LogOut, HardDrive } from "lucide-react";
import { calculateTotalStorage, formatSize } from "../../mocks";

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  // Calculate storage usage
  const usedStorage = calculateTotalStorage();
  const totalStorage = 10 * 1024 * 1024 * 1024; // 10 GB limit
  const storagePercentage = (usedStorage / totalStorage) * 100;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <nav className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link
            to={isAuthenticated ? "/home" : "/"}
            className="flex items-center space-x-3 group"
          >
            <div className="flex items-center justify-center w-11 h-11 bg-gradient-to-br from-primary-600 to-secondary-400 rounded-2xl shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-200">
              <Lock className="h-6 w-6 text-white" strokeWidth={2} />
            </div>
            <span className="text-xl font-bold">
              <span className="bg-gradient-to-r from-primary-600 to-secondary-400 bg-clip-text text-transparent">
                Secure<span className="font-normal">Box</span>
              </span>
            </span>
          </Link>

          {/* User Menu */}
          {isAuthenticated && user ? (
            <div className="flex items-center space-x-4">
              {/* Storage Indicator */}
              <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <HardDrive className="h-4 w-4 text-gray-500" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700">
                      {formatSize(usedStorage)} / {formatSize(totalStorage)}
                    </span>
                  </div>
                  <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        storagePercentage > 90
                          ? "bg-red-500"
                          : storagePercentage > 70
                          ? "bg-yellow-500"
                          : "bg-gradient-to-r from-primary-500 to-secondary-400"
                      }`}
                      style={{ width: `${Math.min(storagePercentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <Link
                to="/profile"
                className="flex items-center space-x-2 px-4 py-2 rounded-xl hover:bg-gray-100/80 transition-all duration-200 group"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-secondary-400 flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-200 overflow-hidden">
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
                <span className="text-sm font-medium text-gray-700 hidden sm:inline">
                  {user.name}
                </span>
              </Link>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="hover:bg-red-50 hover:text-red-600 transition-colors duration-200"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm">Sign Up</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
