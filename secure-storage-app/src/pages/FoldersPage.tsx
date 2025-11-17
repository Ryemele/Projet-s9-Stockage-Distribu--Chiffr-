import React, { useState } from 'react';
import { Plus, Folder as FolderIcon, Search, Grid3x3, List, FileText } from 'lucide-react';
import type { Folder } from '../types/folder';
import { FolderCard } from '../components/folders/FolderCard';
import { CreateFolderModal } from '../components/folders/CreateFolderModal';
import { getRootFolders, getAllFolders, addFolder, deleteFolderById, getAllFiles, calculateTotalStorage, formatSize } from '../mocks';

export const FoldersPage: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [folders, setFolders] = useState<Folder[]>(getAllFolders());

  const handleCreateFolder = (folder: Folder) => {
    addFolder(folder);
    setFolders(getAllFolders());
  };

  const handleDeleteFolder = (folderId: string) => {
    deleteFolderById(folderId);
    setFolders(getAllFolders());
  };

  const handleEditFolder = (folder: Folder) => {
    // TODO: Implement edit functionality
    console.log('Edit folder:', folder);
  };

  // Only show root folders (folders without a parent)
  const rootFolders = folders.filter(folder => !folder.parentFolderId);

  const filteredFolders = rootFolders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    folder.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get exact counts
  const allFiles = getAllFiles();
  const totalFolders = folders.length; // Total number of folders (including subfolders)
  const totalFiles = allFiles.length; // Exact number of files
  const totalSize = calculateTotalStorage(); // Calculate real total size from all files

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Folders</h1>
          <p className="text-gray-600 mt-1">
            Organize your files with folders
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-all shadow-sm hover:shadow-md"
        >
          <Plus className="h-5 w-5" />
          New Folder
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
              <FolderIcon className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Folders</p>
              <p className="text-2xl font-bold text-gray-900">{totalFolders}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Files</p>
              <p className="text-2xl font-bold text-gray-900">{totalFiles}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <FolderIcon className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Size</p>
              <p className="text-2xl font-bold text-gray-900">{formatSize(totalSize)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and View Toggle */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'grid'
                ? 'bg-primary-50 text-primary-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            title="Grid view"
          >
            <Grid3x3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'list'
                ? 'bg-primary-50 text-primary-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            title="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Folders Grid/List */}
      {filteredFolders.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
            <FolderIcon className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery ? 'No folders found' : 'No folders yet'}
          </h3>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            {searchQuery
              ? 'Try adjusting your search terms'
              : 'Create your first folder to organize your files'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-all"
            >
              <Plus className="h-5 w-5" />
              Create Your First Folder
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Column Headers for List View */}
          {viewMode === 'list' && (
            <div className="flex items-center justify-between px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="w-8"></div>
                <span>Name</span>
              </div>
              <div className="hidden md:flex items-center px-4 w-32">
                <span>Items</span>
              </div>
              <div className="hidden lg:flex items-center px-4 w-24">
                <span>Size</span>
              </div>
              <div className="hidden xl:flex items-center px-4 w-32">
                <span>Modified</span>
              </div>
              <div className="w-32"></div>
            </div>
          )}

          {/* Folders */}
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
              : 'space-y-1'
          }>
            {filteredFolders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                onDelete={handleDeleteFolder}
                onEdit={handleEditFolder}
                viewMode={viewMode}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateModal && (
        <CreateFolderModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateFolder}
        />
      )}
    </div>
  );
};
