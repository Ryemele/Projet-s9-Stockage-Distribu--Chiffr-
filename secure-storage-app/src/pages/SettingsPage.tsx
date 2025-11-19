import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";

export const SettingsPage: React.FC = () => {
  const [notifications, setNotifications] = useState({
    fileUploads: true,
    fileShares: true,
  });
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your account preferences and security settings
        </p>
      </div>

      {/* Settings Content */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200 shadow-sm">
        {/* Security Section */}
        <div className="p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Security</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Two-factor authentication</p>
                <p className="text-xs text-gray-500 mt-1">Add an extra layer of security</p>
              </div>
              <button className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                Enable
              </button>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-sm font-medium text-gray-900">Change password</p>
                <p className="text-xs text-gray-500 mt-1">Update your account password</p>
              </div>
              <button className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                Change
              </button>
            </div>
          </div>
        </div>

        {/* Encryption Section */}
        <div className="p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Encryption</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">End-to-end encryption</p>
                <p className="text-xs text-gray-500 mt-1">All files are encrypted on your device</p>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                Active
              </span>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-sm font-medium text-gray-900">Export keys</p>
                <p className="text-xs text-gray-500 mt-1">Download a backup of your encryption keys</p>
              </div>
              <button className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Notifications</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">File uploads</p>
                <p className="text-xs text-gray-500 mt-1">Get notified when files are uploaded</p>
              </div>
              <button
                onClick={() => setNotifications({ ...notifications, fileUploads: !notifications.fileUploads })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                  notifications.fileUploads ? 'bg-primary-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.fileUploads ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-sm font-medium text-gray-900">File shares</p>
                <p className="text-xs text-gray-500 mt-1">Get notified when files are shared with you</p>
              </div>
              <button
                onClick={() => setNotifications({ ...notifications, fileShares: !notifications.fileShares })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                  notifications.fileShares ? 'bg-primary-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.fileShares ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Appearance</h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Dark mode</p>
              <p className="text-xs text-gray-500 mt-1">Switch between light and dark theme</p>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                darkMode ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  darkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="p-6 bg-red-50/50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Danger Zone</h3>
              <p className="text-sm text-gray-600 mb-4">
                Permanently delete your account and all data. This action cannot be undone.
              </p>
              <button className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
