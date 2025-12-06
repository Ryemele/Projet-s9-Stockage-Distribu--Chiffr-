import React from "react";
import { Folder as FolderIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const FolderDetailPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
          <FolderIcon className="h-10 w-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Folders Coming Soon
        </h3>
        <p className="text-gray-500 text-sm mb-6">
          This feature is in development.
        </p>
        <button
          onClick={() => navigate("/files")}
          className="px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700"
        >
          Go to Files
        </button>
      </div>
    </div>
  );
};
