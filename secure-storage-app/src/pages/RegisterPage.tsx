import React from 'react';
import { RegisterForm } from '../components/auth/RegisterForm';
import { Card } from '../components/ui';
import { Lock } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Secure Storage
          </h1>
          <p className="text-gray-600">
            Create your encrypted storage account
          </p>
        </div>

        <Card>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Account</h2>
          <RegisterForm />
        </Card>

        <p className="text-center mt-6 text-sm text-gray-600">
          Your encryption keys are generated from your password
        </p>
      </div>
    </div>
  );
};
