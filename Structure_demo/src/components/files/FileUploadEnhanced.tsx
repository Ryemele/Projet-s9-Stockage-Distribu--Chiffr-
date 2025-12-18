import React, { useState, useCallback } from 'react';
import { Upload, FileIcon, Lock, Layers, Send, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { afghFileService } from '../../services/afghFileService';
import { chunkingService } from '../../services/chunkingService';
import type { AFGHFileEnvelope } from '../../types/afgh';

interface UploadPhase {
    id: string;
    name: string;
    icon: React.ReactNode;
    status: 'pending' | 'active' | 'complete' | 'error';
    detail?: string;
}

interface FileUploadEnhancedProps {
    onUploadComplete?: (envelope: AFGHFileEnvelope) => void;
    onError?: (error: Error) => void;
}

export const FileUploadEnhanced: React.FC<FileUploadEnhancedProps> = ({
    onUploadComplete,
    onError,
}) => {
    const { keyPair } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [phases, setPhases] = useState<UploadPhase[]>([
        { id: 'chunk', name: 'Chunking', icon: <Layers className="h-4 w-4" />, status: 'pending' },
        { id: 'encrypt', name: 'AFGH Encryption', icon: <Lock className="h-4 w-4" />, status: 'pending' },
        { id: 'distribute', name: 'Distributed Storage', icon: <Send className="h-4 w-4" />, status: 'pending' },
    ]);

    const updatePhase = (id: string, updates: Partial<UploadPhase>) => {
        setPhases(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            setFile(droppedFile);
        }
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    const handleUpload = async () => {
        if (!file || !keyPair) {
            onError?.(new Error('No file selected or not authenticated'));
            return;
        }

        setUploading(true);
        setProgress(0);

        // Reset phases
        setPhases(prev => prev.map(p => ({ ...p, status: 'pending', detail: undefined })));

        try {
            // Phase 1: Chunking
            updatePhase('chunk', { status: 'active', detail: 'Splitting file...' });

            const estimatedChunks = chunkingService.estimateChunks(file.size);
            updatePhase('chunk', { detail: `0/${estimatedChunks} chunks` });

            // Phase 2 & 3: Encrypt with AFGH (includes chunking internally)
            updatePhase('chunk', { status: 'complete', detail: `${estimatedChunks} chunks ready` });
            updatePhase('encrypt', { status: 'active', detail: 'Generating secret...' });

            const envelope = await afghFileService.encryptFile(
                file,
                keyPair,
                (progressPercent, phase, detail) => {
                    setProgress(progressPercent);

                    if (phase === 'Chunking') {
                        updatePhase('chunk', { status: 'active', detail });
                    } else if (phase === 'KEM' || phase === 'DEM') {
                        if (phase === 'KEM') {
                            updatePhase('chunk', { status: 'complete' });
                        }
                        updatePhase('encrypt', { status: 'active', detail });
                    } else if (phase === 'Finalizing' || phase === 'Complete') {
                        updatePhase('encrypt', { status: 'complete', detail: 'AFGH Level 2' });
                        updatePhase('distribute', { status: 'active', detail: 'Sending to nodes...' });
                    }
                }
            );

            // Phase 3: Distribute to storage nodes
            updatePhase('distribute', { detail: 'Uploading to gateway...' });

            // Send to backend
            const token = localStorage.getItem('token');
            const response = await fetch('https://localhost:3000/api/distributed/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: afghFileService.serializeEnvelope(envelope),
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            updatePhase('distribute', { status: 'complete', detail: `RS(4,2) across 6 nodes` });
            setProgress(100);

            onUploadComplete?.(envelope);

        } catch (error: any) {
            console.error('Upload failed:', error);

            // Mark failed phase
            const activePhase = phases.find(p => p.status === 'active');
            if (activePhase) {
                updatePhase(activePhase.id, { status: 'error', detail: error.message });
            }

            onError?.(error);
        } finally {
            setUploading(false);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getPhaseIcon = (phase: UploadPhase) => {
        switch (phase.status) {
            case 'complete':
                return <Check className="h-4 w-4 text-green-500" />;
            case 'active':
                return <Loader2 className="h-4 w-4 text-primary-500 animate-spin" />;
            case 'error':
                return <AlertCircle className="h-4 w-4 text-red-500" />;
            default:
                return phase.icon;
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Secure File Upload
            </h3>

            {/* Drop Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-all
          ${isDragging
                        ? 'border-primary-400 bg-primary-50'
                        : file
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-300 hover:border-primary-300 hover:bg-gray-50'
                    }
        `}
            >
                <input
                    type="file"
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploading}
                />

                {file ? (
                    <div className="flex items-center justify-center gap-4">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <FileIcon className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="text-left">
                            <p className="font-medium text-gray-900">{file.name}</p>
                            <p className="text-sm text-gray-500">
                                {formatFileSize(file.size)} • {chunkingService.estimateChunks(file.size)} chunks
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? 'text-primary-500' : 'text-gray-400'}`} />
                        <p className="text-gray-600 mb-2">
                            {isDragging ? 'Drop to upload' : 'Drag & drop a file here'}
                        </p>
                        <p className="text-sm text-gray-400">or click to browse</p>
                    </>
                )}
            </div>

            {/* Upload Phases */}
            {file && (
                <div className="mt-6 space-y-3">
                    {phases.map((phase, _index) => (
                        <div key={phase.id} className="flex items-center gap-4">
                            <div className={`
                w-8 h-8 rounded-full flex items-center justify-center
                ${phase.status === 'complete' ? 'bg-green-100' :
                                    phase.status === 'active' ? 'bg-primary-100' :
                                        phase.status === 'error' ? 'bg-red-100' : 'bg-gray-100'
                                }
              `}>
                                {getPhaseIcon(phase)}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <span className={`font-medium ${phase.status === 'complete' ? 'text-green-700' :
                                        phase.status === 'active' ? 'text-primary-700' :
                                            phase.status === 'error' ? 'text-red-700' : 'text-gray-500'
                                        }`}>
                                        {phase.name}
                                    </span>
                                    {phase.detail && (
                                        <span className="text-xs text-gray-500">{phase.detail}</span>
                                    )}
                                </div>
                                {phase.status === 'active' && (
                                    <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary-500 transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload Button */}
            <button
                onClick={handleUpload}
                disabled={!file || uploading || !keyPair}
                className={`
          mt-6 w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2
          transition-all
          ${!file || uploading || !keyPair
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-primary-600 to-secondary-500 text-white hover:shadow-lg'
                    }
        `}
            >
                {uploading ? (
                    <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Uploading securely...
                    </>
                ) : (
                    <>
                        <Lock className="h-5 w-5" />
                        Encrypt & Upload
                    </>
                )}
            </button>

            {/* Security Info */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 text-center">
                    🔐 End-to-end encrypted with AFGH Proxy Re-Encryption (BLS12-381) •
                    📦 RS(4,2) erasure coding across 6 nodes
                </p>
            </div>
        </div>
    );
};
