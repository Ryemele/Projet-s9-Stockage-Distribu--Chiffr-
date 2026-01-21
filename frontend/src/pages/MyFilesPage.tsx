import React, { useState, useEffect } from 'react';
import { Search, Clock, Star, FileIcon, FolderIcon, Grid3x3, List, SlidersHorizontal } from 'lucide-react';
import { FileTable } from '../components/files/FileTable';
import { FileGrid } from '../components/files/FileGrid';
import { FileShareDialog } from '../components/files/FileShareDialog';
import { apiService } from '../services/apiService';
import { afghFileService } from '../services/crypto/afghFileService';
import { useAuth } from '../contexts/AuthContext';
import type { EncryptedFile } from '../types';
import type { AFGHFileEnvelope } from '../types/afgh';

type FilterType = 'all' | 'recent' | 'starred' | 'documents' | 'images';
type SortType = 'name' | 'date' | 'size';

export const MyFilesPage: React.FC = () => {
  const { user, keyPair } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [files, setFiles] = useState<EncryptedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Share modal state
  const [shareModalFile, setShareModalFile] = useState<EncryptedFile | null>(null);
  const [shareEnvelope, setShareEnvelope] = useState<AFGHFileEnvelope | null>(null);
  const [loadingShareEnvelope, setLoadingShareEnvelope] = useState(false);

  // Fetch files from API
  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const userFiles = await apiService.getFiles();
      setFiles(userFiles);
    } catch (err) {
      console.error('[MyFilesPage] Error loading files:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle file download with AFGH decryption
  const handleDownload = async (file: { id: string; name: string }) => {
    if (!user || !keyPair) {
      alert('You must be logged in to download files');
      return;
    }

    try {
      setDownloadingId(file.id);
      setDownloadProgress(0);
      console.log('[MyFilesPage] Starting download for:', file.name);

      // Step 1: Download encrypted file from backend
      console.log('[MyFilesPage] Fetching encrypted file from server...');
      setDownloadProgress(10);
      const encryptedBlob = await apiService.downloadFile(file.id);

      // Step 2: Read blob as text (it's a JSON envelope)
      console.log('[MyFilesPage] Reading encrypted envelope...');
      setDownloadProgress(20);
      const envelopeText = await encryptedBlob.text();

      // Step 3: Deserialize the AFGH envelope
      console.log('[MyFilesPage] Deserializing envelope...');
      const envelope = afghFileService.deserializeEnvelope(envelopeText);
      console.log('[MyFilesPage] Envelope loaded:', envelope.fileId);

      // Step 4: Decrypt the file with AFGH service
      console.log('[MyFilesPage] Decrypting file with AFGH...');
      const decryptedFile = await afghFileService.decryptFileOwner(
        envelope,
        keyPair,
        (progress, message) => {
          const mappedProgress = 30 + Math.round(progress * 0.6);
          setDownloadProgress(mappedProgress);
          console.log(`[MyFilesPage] ${message} (${progress}%)`);
        }
      );

      console.log('[MyFilesPage] File decrypted successfully:', decryptedFile.fileName);
      setDownloadProgress(95);

      // Step 5: Create Blob and trigger download
      const blob = new Blob([decryptedFile.data], {
        type: decryptedFile.mimeType,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = decryptedFile.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadProgress(100);
      console.log('[MyFilesPage] Download complete!');
    } catch (err) {
      console.error('[MyFilesPage] Download error:', err);
      alert(`Failed to download file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
    }
  };

  // Handle file delete
  const handleDelete = async (file: { id: string; name: string }) => {
    if (!confirm(`Delete ${file.name}?`)) return;

    try {
      await apiService.deleteFile(file.id);
      setFiles(files.filter(f => f.id !== file.id));
    } catch (err) {
      console.error('[MyFilesPage] Delete error:', err);
      alert('Failed to delete file');
    }
  };

  // Handle star toggle
  const handleToggleStar = async (file: { id: string }) => {
    // TODO: Implement star toggle API
    console.log('Toggle star for:', file.id);
  };

  // Handle share - load envelope and show dialog
  const handleShare = async (file: { id: string; name: string }) => {
    const fullFile = files.find(f => f.id === file.id);
    if (!fullFile) return;

    try {
      setLoadingShareEnvelope(true);
      setShareModalFile(fullFile);

      // Download and parse the envelope for sharing
      console.log('[MyFilesPage] Loading envelope for sharing:', file.name);
      const encryptedBlob = await apiService.downloadFile(file.id);
      const envelopeText = await encryptedBlob.text();
      const envelope = afghFileService.deserializeEnvelope(envelopeText);

      setShareEnvelope(envelope);
      console.log('[MyFilesPage] Envelope loaded for sharing');
    } catch (err) {
      console.error('[MyFilesPage] Error loading envelope for share:', err);
      alert('Failed to prepare file for sharing. Please try again.');
      setShareModalFile(null);
    } finally {
      setLoadingShareEnvelope(false);
    }
  };

  // Handle share complete
  const handleShareComplete = () => {
    setShareModalFile(null);
    setShareEnvelope(null);
  };

  // Filter files based on active filter
  const getFilteredFiles = () => {
    let filtered = files;

    // Apply filter
    switch (activeFilter) {
      case 'recent': {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        filtered = files.filter(
          (file) => new Date(file.uploadedAt) >= sevenDaysAgo
        );
        break;
      }
      case 'starred':
        filtered = files.filter((file) => file.starred === true);
        break;
      case 'documents':
        filtered = files.filter(
          (file) =>
            file.mimeType?.includes('pdf') ||
            file.mimeType?.includes('document') ||
            file.mimeType?.includes('text') ||
            file.mimeType?.includes('spreadsheet')
        );
        break;
      case 'images':
        filtered = files.filter(
          (file) =>
            file.mimeType?.includes('image') ||
            file.name.endsWith('.jpg') ||
            file.name.endsWith('.png')
        );
        break;
      default:
        filtered = files;
    }

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter((file) =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sort
    const sorted = [...filtered];
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'size':
        sorted.sort((a, b) => b.size - a.size);
        break;
      case 'date':
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );
    }

    return sorted;
  };

  const filteredFiles = getFilteredFiles();

  // Count files for each filter
  const getFilterCount = (filterType: FilterType): number => {
    switch (filterType) {
      case 'all':
        return files.length;
      case 'recent': {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return files.filter((file) => new Date(file.uploadedAt) >= sevenDaysAgo).length;
      }
      case 'starred':
        return files.filter((file) => file.starred === true).length;
      case 'documents':
        return files.filter(
          (file) =>
            file.mimeType?.includes('pdf') ||
            file.mimeType?.includes('document') ||
            file.mimeType?.includes('text') ||
            file.mimeType?.includes('spreadsheet')
        ).length;
      case 'images':
        return files.filter(
          (file) =>
            file.mimeType?.includes('image') ||
            file.name.endsWith('.jpg') ||
            file.name.endsWith('.png')
        ).length;
      default:
        return 0;
    }
  };

  const filters = [
    { id: 'all' as FilterType, label: 'All files', icon: FileIcon, count: getFilterCount('all') },
    { id: 'recent' as FilterType, label: 'Recent', icon: Clock, count: getFilterCount('recent') },
    { id: 'starred' as FilterType, label: 'Starred', icon: Star, count: getFilterCount('starred') },
    { id: 'documents' as FilterType, label: 'Documents', icon: FileIcon, count: getFilterCount('documents') },
    { id: 'images' as FilterType, label: 'Images', icon: FolderIcon, count: getFilterCount('images') },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Files</h1>
          <p className="text-gray-600 mt-1">
            Manage your encrypted files securely
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {/* Filter Tabs */}
            <div className="flex items-center gap-2">
              {filters.map((filter) => {
                const Icon = filter.icon;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${activeFilter === filter.id
                        ? 'bg-primary-50 text-primary-700 border border-primary-200'
                        : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    {filter.label}
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                      activeFilter === filter.id
                        ? 'bg-primary-100 text-primary-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {filter.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* View Controls */}
            <div className="flex items-center gap-2">
              {/* Sort Dropdown */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <SlidersHorizontal className="h-4 w-4 text-gray-500" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortType)}
                  className="text-sm text-gray-700 bg-transparent border-none focus:outline-none cursor-pointer"
                >
                  <option value="date">Sort by Date</option>
                  <option value="name">Sort by Name</option>
                  <option value="size">Sort by Size</option>
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white text-primary-600 shadow-sm'
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
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <FileIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
              <p className="text-gray-500">Upload some files to get started</p>
            </div>
          ) : viewMode === 'list' ? (
            <FileTable
              files={filteredFiles.map(f => ({
                id: f.id,
                name: f.name,
                size: f.size,
                uploadedAt: f.uploadedAt,
                uploadedBy: user?.email,
                encrypted: true,
                starred: f.starred,
                mimeType: f.mimeType,
              }))}
              showStats={false}
              showSearch={false}
              showUploadButton={false}
              canDelete={true}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onShare={handleShare}
              onToggleStar={handleToggleStar}
              downloadingId={downloadingId}
              downloadProgress={downloadProgress}
            />
          ) : (
            <FileGrid
              files={filteredFiles.map(f => ({
                id: f.id,
                name: f.name,
                size: f.size,
                uploadedAt: f.uploadedAt,
                uploadedBy: user?.email,
                encrypted: true,
                starred: f.starred,
                mimeType: f.mimeType,
              }))}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onShare={handleShare}
              onToggleStar={handleToggleStar}
              downloadingId={downloadingId}
            />
          )}
        </div>
      </div>

      {/* Share File Dialog */}
      {shareModalFile && shareEnvelope && (
        <FileShareDialog
          fileId={shareModalFile.id}
          fileName={shareModalFile.name}
          envelope={shareEnvelope}
          onClose={() => {
            setShareModalFile(null);
            setShareEnvelope(null);
          }}
          onShareComplete={handleShareComplete}
        />
      )}

      {/* Loading overlay when preparing to share */}
      {loadingShareEnvelope && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            <span className="text-gray-700">Preparing file for sharing...</span>
          </div>
        </div>
      )}
    </div>
  );
};
