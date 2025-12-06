import React from "react";
import { Folder as FolderIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const FoldersPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Folders</h1>
        <p className="text-gray-600 mt-1">Organize your files with folders</p>
      </div>

      {/* Empty State - Folders feature coming soon */}
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
          <FolderIcon className="h-10 w-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Folders Coming Soon
        </h3>
        <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
          The folder organization feature is currently in development.
          For now, you can manage all your files in the Files section.
        </p>
        <button
          onClick={() => navigate("/files")}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-all"
        >
          Go to Files
        </button>
      </div>
    </div>
  );
};
