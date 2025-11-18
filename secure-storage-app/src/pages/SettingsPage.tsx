import React from "react";
import { Lock, Bell, Shield, Palette } from "lucide-react";

export const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage your account preferences and security settings
        </p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-4">
        {/* Security */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-primary-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">Security</h3>
              <p className="text-sm text-gray-600 mt-1">
                Configure your encryption and authentication settings
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Two-factor authentication
                    </p>
                    <p className="text-xs text-gray-500">
                      Add an extra layer of security
                    </p>
                  </div>
                  <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                    Enable
                  </button>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Change password
                    </p>
                    <p className="text-xs text-gray-500">
                      Update your account password
                    </p>
                  </div>
                  <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                    Change
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Encryption */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Lock className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                Encryption
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Manage your encryption keys and security preferences
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      End-to-end encryption
                    </p>
                    <p className="text-xs text-gray-500">
                      All files are encrypted on your device
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Export keys
                    </p>
                    <p className="text-xs text-gray-500">
                      Download a backup of your encryption keys
                    </p>
                  </div>
                  <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                    Export
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bell className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                Notifications
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Choose what notifications you want to receive
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      File uploads
                    </p>
                    <p className="text-xs text-gray-500">
                      Get notified when files are uploaded
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      defaultChecked
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      File shares
                    </p>
                    <p className="text-xs text-gray-500">
                      Get notified when files are shared with you
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      defaultChecked
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-pink-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Palette className="h-5 w-5 text-pink-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                Appearance
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Customize how SecureBox looks
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Theme</p>
                    <p className="text-xs text-gray-500">
                      Select your preferred theme
                    </p>
                  </div>
                  <select className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option>Light</option>
                    <option>Dark</option>
                    <option>System</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
