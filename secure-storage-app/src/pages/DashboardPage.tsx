import React, { useState } from 'react';
import { FileUpload } from '../components/files/FileUpload';
import { FileList } from '../components/files/FileList';
import { Card } from '../components/ui';
import { Upload, Files } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'files'>('files');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = () => {
    setRefreshKey((prev) => prev + 1);
    setActiveTab('files');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Files</h1>
        <p className="text-gray-600 mt-1">
          Manage your encrypted files securely
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('files')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === 'files'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <Files className="inline-block h-5 w-5 mr-2" />
            My Files
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === 'upload'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <Upload className="inline-block h-5 w-5 mr-2" />
            Upload
          </button>
        </nav>
      </div>

      {/* Content */}
      <Card>
        {activeTab === 'upload' ? (
          <FileUpload onUploadComplete={handleUploadComplete} />
        ) : (
          <FileList key={refreshKey} />
        )}
      </Card>
    </div>
  );
};
