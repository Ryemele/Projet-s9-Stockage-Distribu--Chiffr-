import React, { useState, useEffect } from "react";
import {
  Folder as FolderIcon,
  Plus,
  MoreVertical,
  Edit3,
  Trash2,
  ChevronRight,
  Search,
  Grid,
  List
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface Folder {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  file_count?: number;
}

const COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#0ea5e9', // sky
];

export const FoldersPage: React.FC = () => {
  const { user } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(COLORS[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/folders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFolders(data.folders || []);
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newFolderName, color: newFolderColor })
      });
      if (response.ok) {
        const data = await response.json();
        setFolders([data.folder, ...folders]);
        setShowCreateModal(false);
        setNewFolderName('');
        setNewFolderColor(COLORS[0]);
      }
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const updateFolder = async () => {
    if (!editingFolder || !newFolderName.trim()) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/folders/${editingFolder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newFolderName, color: newFolderColor })
      });
      if (response.ok) {
        const data = await response.json();
        setFolders(folders.map(f => f.id === data.folder.id ? data.folder : f));
        setEditingFolder(null);
        setNewFolderName('');
        setNewFolderColor(COLORS[0]);
      }
    } catch (error) {
      console.error('Error updating folder:', error);
    }
  };

  const deleteFolder = async (id: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/folders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setFolders(folders.filter(f => f.id !== id));
        setActiveMenu(null);
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
    }
  };

  const filteredFolders = folders.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openEditModal = (folder: Folder) => {
    setEditingFolder(folder);
    setNewFolderName(folder.name);
    setNewFolderColor(folder.color);
    setActiveMenu(null);
  };

  return (
    <div className="space-y-6 relative">
      {/* Header with gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-8 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl"></div>

        <div className="relative">
          <h1 className="text-3xl font-bold mb-2">Folders</h1>
          <p className="text-white/80">Organize your files into folders for better management</p>

          <div className="flex items-center gap-4 mt-6">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60" />
              <input
                type="text"
                placeholder="Search folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
              />
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 font-semibold rounded-xl hover:bg-white/90 transition-all shadow-lg hover:shadow-xl"
            >
              <Plus className="h-5 w-5" />
              New Folder
            </button>
          </div>
        </div>
      </div>

      {/* View Toggle & Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <FolderIcon className="h-4 w-4" />
          <span>{folders.length} folder{folders.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Folders Grid/List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredFolders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl mb-4">
            <FolderIcon className="h-10 w-10 text-indigo-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchQuery ? 'No folders found' : 'Create your first folder'}
          </h3>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            {searchQuery
              ? 'Try a different search term'
              : 'Organize your files by creating folders. Click the button above to get started.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFolders.map((folder) => (
            <div
              key={folder.id}
              className="group relative bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-lg hover:border-gray-300 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${folder.color}20` }}
                >
                  <FolderIcon className="h-7 w-7" style={{ color: folder.color }} />
                </div>
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenu(activeMenu === folder.id ? null : folder.id);
                    }}
                    className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all"
                  >
                    <MoreVertical className="h-5 w-5 text-gray-500" />
                  </button>

                  {activeMenu === folder.id && (
                    <div className="absolute right-0 top-8 w-40 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(folder); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Edit3 className="h-4 w-4" /> Rename
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <h3 className="font-semibold text-gray-900 mb-1 truncate">{folder.name}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{folder.file_count || 0} files</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y">
          {filteredFolders.map((folder) => (
            <div
              key={folder.id}
              className="group flex items-center justify-between p-4 hover:bg-gray-50 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${folder.color}20` }}
                >
                  <FolderIcon className="h-6 w-6" style={{ color: folder.color }} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{folder.name}</h3>
                  <p className="text-sm text-gray-500">{folder.file_count || 0} files</p>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={(e) => { e.stopPropagation(); openEditModal(folder); }}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  <Edit3 className="h-4 w-4 text-gray-500" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }}
                  className="p-2 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingFolder) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingFolder ? 'Rename Folder' : 'Create New Folder'}
            </h2>

            <input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-4"
              autoFocus
            />

            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewFolderColor(color)}
                    className={`w-8 h-8 rounded-full transition-all ${newFolderColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingFolder(null);
                  setNewFolderName('');
                  setNewFolderColor(COLORS[0]);
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={editingFolder ? updateFolder : createFolder}
                disabled={!newFolderName.trim()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg disabled:opacity-50 transition-all"
              >
                {editingFolder ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside handler for menu */}
      {activeMenu && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setActiveMenu(null)}
        />
      )}
    </div>
  );
};
