import React, { useState } from 'react';
import { X, Folder, Check, Sparkles } from 'lucide-react';
import type { Folder as FolderType, FolderColor } from '../../types/folder';
import { FOLDER_COLORS } from '../../types/folder';

interface CreateFolderModalProps {
  onClose: () => void;
  onCreate: (folder: FolderType) => void;
  parentFolderId?: string | null;
  parentFolderName?: string;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({ onClose, onCreate, parentFolderId, parentFolderName }) => {
  const [folderName, setFolderName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState<FolderColor>('blue');

  const handleCreate = () => {
    if (!folderName.trim()) return;

    const newFolder: FolderType = {
      id: Date.now().toString(),
      name: folderName.trim(),
      description: description.trim(),
      color: selectedColor,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fileCount: 0,
      size: 0,
      parentFolderId: parentFolderId || null,
    };

    onCreate(newFolder);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className={`relative bg-gradient-to-r ${FOLDER_COLORS[selectedColor].gradient} px-6 py-8`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Folder className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {parentFolderId ? 'Create Subfolder' : 'Create New Folder'}
              </h2>
              <p className="text-white/90 mt-1">
                {parentFolderId ? `Inside ${parentFolderName}` : 'Organize your files with folders'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Folder Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Folder Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g., Work Documents, Personal Photos"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will you store here?"
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Choose a color
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              {(Object.keys(FOLDER_COLORS) as FolderColor[]).map((color) => {
                const isSelected = selectedColor === color;
                const colorConfig = FOLDER_COLORS[color];

                return (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`relative w-10 h-10 rounded-full bg-gradient-to-br ${colorConfig.gradient} transition-all duration-200 ${
                      isSelected
                        ? 'ring-3 ring-offset-2 ring-gray-400 scale-110'
                        : 'hover:scale-110'
                    }`}
                    title={color}
                  >
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check className="h-5 w-5 text-white drop-shadow-lg" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          <div className={`bg-gradient-to-br ${FOLDER_COLORS[selectedColor].gradient} rounded-lg p-4`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <Folder className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold">
                  {folderName || 'Folder Name'}
                </p>
                <p className="text-white/80 text-sm">
                  {description || 'No description'}
                </p>
              </div>
              <Sparkles className="h-5 w-5 text-white/60" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!folderName.trim()}
            className={`px-6 py-2.5 bg-gradient-to-r ${FOLDER_COLORS[selectedColor].gradient} text-white rounded-lg hover:opacity-90 transition-all font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Create Folder
          </button>
        </div>
      </div>
    </div>
  );
};
