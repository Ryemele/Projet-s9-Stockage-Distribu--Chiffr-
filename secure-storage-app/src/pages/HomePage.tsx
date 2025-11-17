import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Folder as FolderIcon, FileIcon, Plus } from "lucide-react";
import type { Folder } from "../types/folder";
import type { EncryptedFile } from "../types";
import { FolderCard } from "../components/folders/FolderCard";
import { CreateFolderModal } from "../components/folders/CreateFolderModal";
import { FileTable } from "../components/files/FileTable";
import {
  getRootFolders,
  getAllFiles,
  addFolder,
  calculateTotalStorage,
  formatSize,
  toggleFileStarred,
  deleteFileById,
} from "../mocks";

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Use mock data from centralized location
  const [folders, setFolders] = useState<Folder[]>(getRootFolders());

  // Get recent files (last 5 files)
  const recentFiles: EncryptedFile[] = getAllFiles()
    .sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )
    .slice(0, 5);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Handle file upload
    navigate("/upload");
  };

  const handleCreateFolder = (folder: Folder) => {
    addFolder(folder);
    setFolders(getRootFolders());
  };

  const handleDeleteFolder = (folderId: string) => {
    setFolders(folders.filter((f) => f.id !== folderId));
  };

  const handleEditFolder = (folder: Folder) => {
    console.log("Edit folder:", folder);
  };

  const handleDeleteFile = (file: EncryptedFile) => {
    deleteFileById(file.id);
    setRefreshKey((prev) => prev + 1);
  };

  const handleDownloadFile = (file: EncryptedFile) => {
    console.log("Download file:", file.id);
    alert(`Downloading ${file.name}...`);
  };

  const handleShareFile = (file: EncryptedFile) => {
    console.log("Share file:", file.id);
    alert(`Share ${file.name} with team`);
  };

  const handleToggleStar = (file: EncryptedFile) => {
    toggleFileStarred(file.id);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-8">
      {/* Hero Section with Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-2xl transition-all duration-300 ${
          isDragging
            ? "bg-primary-50 border-2 border-primary-400 border-dashed"
            : "bg-gradient-to-br from-primary-600 via-primary-500 to-secondary-400"
        }`}
      >
        <div className="relative z-10 px-8 py-12">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold text-white mb-3">
              {isDragging ? "Drop files to upload" : "Welcome to SecureBox !"}
            </h1>
            <p className="text-white/90 text-lg mb-8">
              {isDragging
                ? "Release to start uploading your files securely"
                : "Your secure, encrypted file storage solution"}
            </p>

            {!isDragging && (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate("/upload")}
                  className="px-6 py-3 bg-white text-primary-600 font-semibold rounded-lg hover:bg-white/90 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                >
                  <Upload className="h-5 w-5" />
                  Upload Files
                </button>
                <button
                  onClick={() => setShowCreateFolderModal(true)}
                  className="px-6 py-3 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-lg hover:bg-white/20 transition-all border border-white/20 flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  New Folder
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary-400/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"></div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
              <FolderIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Folders</p>
              <p className="text-2xl font-bold text-gray-900">
                {folders.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-secondary-50 rounded-xl flex items-center justify-center">
              <FileIcon className="h-6 w-6 text-secondary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Files</p>
              <p className="text-2xl font-bold text-gray-900">
                {getAllFiles().length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
              <Upload className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Storage Used</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatSize(calculateTotalStorage())}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Folders Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Folders</h2>
            <p className="text-sm text-gray-600 mt-1">Organize your files</p>
          </div>
          <button
            onClick={() => navigate("/folders")}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            View all →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {folders.slice(0, 4).map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              onDelete={handleDeleteFolder}
              onEdit={handleEditFolder}
            />
          ))}
        </div>
      </div>

      {/* Recent Files Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Recent Files</h2>
            <p className="text-sm text-gray-600 mt-1">Your latest uploads</p>
          </div>
          <button
            onClick={() => navigate("/files")}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            View all →
          </button>
        </div>

        <FileTable
          key={refreshKey}
          files={recentFiles}
          onDelete={handleDeleteFile}
          onDownload={handleDownloadFile}
          onShare={handleShareFile}
          onToggleStar={handleToggleStar}
        />
      </div>

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <CreateFolderModal
          onClose={() => setShowCreateFolderModal(false)}
          onCreate={handleCreateFolder}
        />
      )}
    </div>
  );
};
