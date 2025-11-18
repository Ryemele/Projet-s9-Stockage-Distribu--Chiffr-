import type { EncryptedFile } from '../types';

export const mockFiles: EncryptedFile[] = [
  {
    id: 'file-1',
    name: 'Project Proposal.pdf',
    size: 45678901, // ~43.5 MB
    mimeType: 'application/pdf',
    uploadedAt: new Date('2024-03-10T10:30:00').toISOString(),
    userId: 'user-1',
    encryptedDataUrl: 'mock-encrypted-data-1',
    iv: 'mock-iv-1',
    salt: 'mock-salt-1',
    uploadedBy: 'admin@example.com',
    folderId: '1', // Work folder
    starred: true,
    teamId: 'team-1', // Shared with Engineering Team
  },
  {
    id: 'file-2',
    name: 'Team Guidelines.docx',
    size: 8456789, // ~8 MB
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    uploadedAt: new Date('2024-03-08T14:20:00').toISOString(),
    userId: 'user-1',
    encryptedDataUrl: 'mock-encrypted-data-2',
    iv: 'mock-iv-2',
    salt: 'mock-salt-2',
    uploadedBy: 'admin@example.com',
    folderId: '1', // Work folder
    starred: false,
    teamId: 'team-1', // Shared with Engineering Team
  },
  {
    id: 'file-3',
    name: 'Budget 2024.xlsx',
    size: 15678901, // ~15 MB
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uploadedAt: new Date('2024-03-12T09:15:00').toISOString(),
    userId: 'user-2',
    encryptedDataUrl: 'mock-encrypted-data-3',
    iv: 'mock-iv-3',
    salt: 'mock-salt-3',
    uploadedBy: 'john@example.com',
    folderId: '1', // Work folder
    starred: true,
    teamId: 'team-4', // Shared with Sales Team
  },
  {
    id: 'file-4',
    name: 'Vacation Photos.zip',
    size: 456789012, // ~435 MB
    mimeType: 'application/zip',
    uploadedAt: new Date('2024-03-01T16:45:00').toISOString(),
    userId: 'user-1',
    encryptedDataUrl: 'mock-encrypted-data-4',
    iv: 'mock-iv-4',
    salt: 'mock-salt-4',
    uploadedBy: 'admin@example.com',
    folderId: '3', // Photos folder
    starred: false,
    sharedWith: ['current-user-id'], // Shared with current user
  },
  {
    id: 'file-5',
    name: 'Family Portrait.jpg',
    size: 28456789, // ~27 MB
    mimeType: 'image/jpeg',
    uploadedAt: new Date('2024-02-25T11:30:00').toISOString(),
    userId: 'user-2',
    encryptedDataUrl: 'mock-encrypted-data-5',
    iv: 'mock-iv-5',
    salt: 'mock-salt-5',
    uploadedBy: 'john@example.com',
    folderId: '2', // Personal folder
    starred: false,
    sharedWith: ['current-user-id'], // Shared with current user
  },
  {
    id: 'file-6',
    name: 'Tax Documents.pdf',
    size: 23456789, // ~22.4 MB
    mimeType: 'application/pdf',
    uploadedAt: new Date('2024-02-15T13:20:00').toISOString(),
    userId: 'user-1',
    encryptedDataUrl: 'mock-encrypted-data-6',
    iv: 'mock-iv-6',
    salt: 'mock-salt-6',
    uploadedBy: 'admin@example.com',
    folderId: '4', // Documents folder
    starred: true,
  },
  {
    id: 'file-7',
    name: 'Meeting Notes.txt',
    size: 456789, // ~446 KB
    mimeType: 'text/plain',
    uploadedAt: new Date('2024-03-14T10:00:00').toISOString(),
    userId: 'user-2',
    encryptedDataUrl: 'mock-encrypted-data-7',
    iv: 'mock-iv-7',
    salt: 'mock-salt-7',
    uploadedBy: 'john@example.com',
    folderId: 'sub-1-1', // Projects subfolder
    starred: false,
    teamId: 'team-2', // Shared with Design Team
  },
  {
    id: 'file-8',
    name: 'Old Report 2023.pdf',
    size: 78901234, // ~75.3 MB
    mimeType: 'application/pdf',
    uploadedAt: new Date('2024-01-20T15:30:00').toISOString(),
    userId: 'user-1',
    encryptedDataUrl: 'mock-encrypted-data-8',
    iv: 'mock-iv-8',
    salt: 'mock-salt-8',
    uploadedBy: 'admin@example.com',
    folderId: 'sub-1-2', // Archive subfolder
    starred: false,
  },
  {
    id: 'file-9',
    name: 'Beach Photos.jpg',
    size: 34567890, // ~33 MB
    mimeType: 'image/jpeg',
    uploadedAt: new Date('2024-03-05T12:15:00').toISOString(),
    userId: 'user-1',
    encryptedDataUrl: 'mock-encrypted-data-9',
    iv: 'mock-iv-9',
    salt: 'mock-salt-9',
    uploadedBy: 'admin@example.com',
    folderId: 'sub-3-1', // Vacation 2024 subfolder
    starred: false,
    teamId: 'team-3', // Shared with Marketing Team
  },
  {
    id: 'file-10',
    name: 'Wedding.mp4',
    size: 234567890, // ~223.7 MB
    mimeType: 'video/mp4',
    uploadedAt: new Date('2024-03-02T18:00:00').toISOString(),
    userId: 'user-3',
    encryptedDataUrl: 'mock-encrypted-data-10',
    iv: 'mock-iv-10',
    salt: 'mock-salt-10',
    uploadedBy: 'jane@example.com',
    folderId: 'sub-3-2', // Events subfolder
    starred: false,
    sharedWith: ['current-user-id', 'user-2'], // Shared with current user and user-2
  },
];

// Helper functions
export const getFileById = (id: string): EncryptedFile | undefined => {
  return mockFiles.find(file => file.id === id);
};

export const getAllFiles = (): EncryptedFile[] => {
  return mockFiles;
};

export const getFilesByFolder = (folderId: string): EncryptedFile[] => {
  return mockFiles.filter(file => file.folderId === folderId);
};

export const getFilesByUser = (userId: string): EncryptedFile[] => {
  return mockFiles.filter(file => file.uploadedBy === userId);
};

export const deleteFileById = (id: string): EncryptedFile[] => {
  const index = mockFiles.findIndex(file => file.id === id);
  if (index > -1) {
    mockFiles.splice(index, 1);
  }
  return mockFiles;
};

export const addFile = (file: EncryptedFile): void => {
  mockFiles.push(file);
};

export const toggleFileStarred = (id: string): EncryptedFile | undefined => {
  const file = mockFiles.find(f => f.id === id);
  if (file) {
    file.starred = !file.starred;
  }
  return file;
};

export const getStarredFiles = (): EncryptedFile[] => {
  return mockFiles.filter(file => file.starred === true);
};

export const getSharedWithMeFiles = (userId: string = 'current-user-id'): EncryptedFile[] => {
  return mockFiles.filter(file => file.sharedWith?.includes(userId));
};
