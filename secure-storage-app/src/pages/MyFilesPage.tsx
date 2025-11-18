import React, { useState } from 'react';
import { Search, Clock, Star, FileIcon, FolderIcon, Grid3x3, List, SlidersHorizontal } from 'lucide-react';
import { FileTable } from '../components/files/FileTable';
import { getAllFiles, toggleFileStarred } from '../mocks';

type FilterType = 'all' | 'recent' | 'starred' | 'documents' | 'images';
type SortType = 'name' | 'date' | 'size';

export const MyFilesPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [refreshKey, setRefreshKey] = useState(0);

  // Get all files from mock data
  const allFiles = getAllFiles();

  // Filter files based on active filter
  const getFilteredFiles = () => {
    let filtered = allFiles;

    // Apply filter
    switch (activeFilter) {
      case 'recent': {
        // Files uploaded in the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        filtered = allFiles.filter(
          (file) => new Date(file.uploadedAt) >= sevenDaysAgo
        );
        break;
      }
      case 'starred':
        filtered = allFiles.filter((file) => file.starred === true);
        break;
      case 'documents':
        filtered = allFiles.filter(
          (file) =>
            file.mimeType.includes('pdf') ||
            file.mimeType.includes('document') ||
            file.mimeType.includes('text') ||
            file.mimeType.includes('spreadsheet')
        );
        break;
      case 'images':
        filtered = allFiles.filter(
          (file) => file.mimeType.includes('image') || file.name.endsWith('.jpg') || file.name.endsWith('.png')
        );
        break;
      default:
        filtered = allFiles;
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

  const handleToggleStar = (file: { id: string }) => {
    toggleFileStarred(file.id);
    setRefreshKey((prev) => prev + 1); // Force re-render
  };

  // Count files for each filter
  const getFilterCount = (filterType: FilterType): number => {
    switch (filterType) {
      case 'all':
      case 'recent': {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return allFiles.filter((file) => new Date(file.uploadedAt) >= sevenDaysAgo).length;
      }
      case 'starred':
        return allFiles.filter((file) => file.starred === true).length;
      case 'documents':
        return allFiles.filter(
          (file) =>
            file.mimeType.includes('pdf') ||
            file.mimeType.includes('document') ||
            file.mimeType.includes('text') ||
            file.mimeType.includes('spreadsheet')
        ).length;
      case 'images':
        return allFiles.filter(
          (file) => file.mimeType.includes('image') || file.name.endsWith('.jpg') || file.name.endsWith('.png')
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
          <FileTable
            key={refreshKey}
            files={filteredFiles.map(f => ({
              id: f.id,
              name: f.name,
              size: f.size,
              uploadedAt: f.uploadedAt,
              uploadedBy: f.uploadedBy,
              encrypted: true,
              starred: f.starred,
            }))}
            showStats={false}
            showSearch={false}
            showUploadButton={false}
            canDelete={true}
            onDownload={(file) => {
              console.log('Download file:', file.id);
              alert(`Downloading ${file.name}...`);
            }}
            onDelete={(file) => {
              if (confirm(`Delete ${file.name}?`)) {
                console.log('Delete file:', file.id);
              }
            }}
            onShare={(file) => {
              console.log('Share file:', file.id);
              alert(`Share ${file.name} with team`);
            }}
            onToggleStar={handleToggleStar}
          />
        </div>
      </div>
    </div>
  );
};
