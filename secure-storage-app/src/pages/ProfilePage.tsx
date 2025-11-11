import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button } from '../components/ui';
import { User, Mail, Calendar, Shield } from 'lucide-react';

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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage your account and security settings
        </p>
      </div>

      <Card>
        <div className="space-y-6">
          <div className="flex items-center space-x-4 pb-6 border-b">
            <div className="h-20 w-20 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="h-10 w-10 text-primary-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
              <p className="text-gray-600">Active Account</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700">Email</p>
                <p className="text-gray-900">{user.email}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700">Member Since</p>
                <p className="text-gray-900">{formatDate(user.createdAt)}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700">Security</p>
                <p className="text-gray-900">End-to-end encryption enabled</p>
                <p className="text-sm text-gray-600 mt-1">
                  All your files are encrypted on your device before being uploaded
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Security Information
        </h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            <strong>Encryption:</strong> Your files are encrypted using AES-256-GCM
            encryption before leaving your device.
          </p>
          <p>
            <strong>Keys:</strong> Your encryption keys are derived from your password
            and never leave your device in plaintext.
          </p>
          <p>
            <strong>Zero-Knowledge:</strong> We cannot access your files even if we
            wanted to. Only you have the keys to decrypt your data.
          </p>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Danger Zone
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Permanently delete your account and all associated data. This action cannot
          be undone.
        </p>
        <Button variant="danger" size="sm">
          Delete Account
        </Button>
      </Card>
    </div>
  );
};
