import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui';
import { Lock, User, LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center space-x-2">
            <div className="flex items-center justify-center w-10 h-10 bg-primary-600 rounded-lg">
              <Lock className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Secure Storage</span>
          </Link>

          {/* User Menu */}
          {isAuthenticated && user ? (
            <div className="flex items-center space-x-4">
              <Link
                to="/profile"
                className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <User className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">{user.name}</span>
              </Link>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
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
                <Button size="sm">
                  Sign Up
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
