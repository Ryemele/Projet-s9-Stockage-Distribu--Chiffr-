import type { Folder } from '../types/folder';

export const mockFolders: Folder[] = [
  {
    id: '1',
    name: 'Work',
    description: 'Work-related documents and files',
    color: 'blue',
    createdAt: new Date('2024-01-15').toISOString(),
    updatedAt: new Date('2024-03-10').toISOString(),
    fileCount: 24,
    size: 15728640,
    parentFolderId: null,
  },
  {
    id: '2',
    name: 'Personal',
    description: 'Personal photos and documents',
    color: 'purple',
    createdAt: new Date('2024-01-20').toISOString(),
    updatedAt: new Date('2024-03-08').toISOString(),
    fileCount: 12,
    size: 8388608,
    parentFolderId: null,
  },
  {
    id: '3',
    name: 'Photos',
    description: 'Photo collection',
    color: 'pink',
    createdAt: new Date('2024-02-01').toISOString(),
    updatedAt: new Date('2024-03-12').toISOString(),
    fileCount: 45,
    size: 52428800,
    parentFolderId: null,
  },
  {
    id: '4',
    name: 'Documents',
    description: 'Important documents',
    color: 'green',
    createdAt: new Date('2024-02-10').toISOString(),
    updatedAt: new Date('2024-03-05').toISOString(),
    fileCount: 18,
    size: 20971520,
    parentFolderId: null,
  },
  // Subfolders of Work (id: 1)
  {
    id: 'sub-1-1',
    name: 'Projects',
    description: 'Active projects',
    color: 'green',
    createdAt: new Date('2024-02-15').toISOString(),
    updatedAt: new Date('2024-03-11').toISOString(),
    fileCount: 8,
    size: 4194304,
    parentFolderId: '1',
  },
  {
    id: 'sub-1-2',
    name: 'Archive',
    description: 'Archived items',
    color: 'orange',
    createdAt: new Date('2024-02-20').toISOString(),
    updatedAt: new Date('2024-03-09').toISOString(),
    fileCount: 15,
    size: 10485760,
    parentFolderId: '1',
  },
  // Subfolders of Personal (id: 2)
  {
    id: 'sub-2-1',
    name: 'Family',
    description: 'Family documents',
    color: 'purple',
    createdAt: new Date('2024-02-25').toISOString(),
    updatedAt: new Date('2024-03-07').toISOString(),
    fileCount: 6,
    size: 3145728,
    parentFolderId: '2',
  },
  // Subfolders of Photos (id: 3)
  {
    id: 'sub-3-1',
    name: 'Vacation 2024',
    description: 'Vacation photos',
    color: 'yellow',
    createdAt: new Date('2024-03-01').toISOString(),
    updatedAt: new Date('2024-03-13').toISOString(),
    fileCount: 28,
    size: 31457280,
    parentFolderId: '3',
  },
  {
    id: 'sub-3-2',
    name: 'Events',
    description: 'Event photos',
    color: 'pink',
    createdAt: new Date('2024-03-02').toISOString(),
    updatedAt: new Date('2024-03-14').toISOString(),
    fileCount: 17,
    size: 20971520,
    parentFolderId: '3',
  },
];

// Helper functions
export const getFolderById = (id: string): Folder | undefined => {
  return mockFolders.find(folder => folder.id === id);
};

export const getRootFolders = (): Folder[] => {
  return mockFolders.filter(folder => !folder.parentFolderId);
};

export const getSubFolders = (parentId: string): Folder[] => {
  return mockFolders.filter(folder => folder.parentFolderId === parentId);
};

export const getAllFolders = (): Folder[] => {
  return mockFolders;
};

export const addFolder = (folder: Folder): void => {
  mockFolders.push(folder);
};

export const deleteFolderById = (id: string): Folder[] => {
  const index = mockFolders.findIndex(folder => folder.id === id);
  if (index > -1) {
    mockFolders.splice(index, 1);
  }
  return mockFolders;
};
