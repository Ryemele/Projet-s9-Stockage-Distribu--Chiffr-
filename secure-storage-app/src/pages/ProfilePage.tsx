import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Calendar, Shield, Key, AlertTriangle } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600 mt-1">
          Manage your personal information and security
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-secondary-400 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
            <User className="h-10 w-10 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
            <p className="text-gray-600 mt-1">Personal Account</p>
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase">Email</p>
                  <p className="text-sm text-gray-900 truncate">{user.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase">Member Since</p>
                  <p className="text-sm text-gray-900">{formatDate(user.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Status */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">Security Status</h3>
            <p className="text-sm text-gray-600 mt-1">Your account is protected with end-to-end encryption</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-700">Encryption enabled</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-700">Keys secured</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Encryption Info */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Key className="h-5 w-5 text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">Encryption Details</h3>
            <p className="text-sm text-gray-600 mt-1">How your data is protected</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 text-sm">
                <div className="w-1.5 h-1.5 bg-primary-600 rounded-full mt-1.5 flex-shrink-0"></div>
                <div>
                  <span className="font-medium text-gray-900">End-to-end encryption:</span>
                  <span className="text-gray-600"> Files are encrypted on your device before upload</span>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-1.5 h-1.5 bg-primary-600 rounded-full mt-1.5 flex-shrink-0"></div>
                <div>
                  <span className="font-medium text-gray-900">Zero-knowledge:</span>
                  <span className="text-gray-600"> Your encryption keys never leave your device</span>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-1.5 h-1.5 bg-primary-600 rounded-full mt-1.5 flex-shrink-0"></div>
                <div>
                  <span className="font-medium text-gray-900">Password-based:</span>
                  <span className="text-gray-600"> Keys are derived from your password using PBKDF2</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-lg border border-red-200 shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">Danger Zone</h3>
            <p className="text-sm text-gray-600 mt-1">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button className="mt-4 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
