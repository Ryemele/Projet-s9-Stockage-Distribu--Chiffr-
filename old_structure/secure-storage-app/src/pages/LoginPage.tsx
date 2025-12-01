import React from "react";
import { LoginForm } from "../components/auth/LoginForm";
import { Card } from "../components/ui";
import { Lock, Key } from "lucide-react";

export const LoginPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-6">
            <img
              src="/Logo_VaultFlow.svg"
              alt="VaultFlow Logo"
              className="h-24 w-auto transform hover:scale-105 transition-transform duration-300"
            />
          </div>
          <h1 className="text-4xl font-bold mb-3">
            <span className="bg-gradient-to-r from-primary-600 to-secondary-400 bg-clip-text text-transparent">
              Secure<span className="font-normal">Box</span>
            </span>
          </h1>
          <p className="text-gray-600 text-lg">
            Zero-knowledge encrypted file storage
          </p>
        </div>

        {/* Login Card */}
        <Card>
          <h2 className="text-2xl font-bold text-gray-800 mb-8 justify-center flex items-center">
            Welcome Back !
          </h2>
          <LoginForm />
        </Card>

        {/* Security Features */}
        <div className="mt-8 glass-card">
          <div className="flex items-center justify-center gap-8 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Lock className="h-4 w-4 text-primary-600" />
              <span>End-to-end encrypted</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Key className="h-4 w-4 text-secondary-400" />
              <span>Secure encryption</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
