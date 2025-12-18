/**
 * Enhanced File Preview Component
 * 
 * Supports:
 * - Images (jpg, png, gif, webp, svg)
 * - PDFs  
 * - Text files (txt, json, csv, md, html, css, js)
 * - Videos (mp4, webm, ogg)
 * - Audio (mp3, wav, ogg)
 */

import React, { useEffect, useState } from 'react';
import { X, Download, FileText, Image as ImageIcon, File, Film, Music, Loader2, Maximize2, Minimize2 } from 'lucide-react';

interface FilePreviewProps {
    file: {
        name: string;
        mimeType: string;
        data: Blob;
    };
    onClose: () => void;
    onDownload: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ file, onClose, onDownload }) => {
    const [content, setContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const isImage = file.mimeType.startsWith('image/');
    const isVideo = file.mimeType.startsWith('video/');
    const isAudio = file.mimeType.startsWith('audio/');
    const isPdf = file.mimeType === 'application/pdf';
    const isText = file.mimeType.startsWith('text/') ||
        file.mimeType === 'application/json' ||
        file.mimeType === 'application/javascript';

    useEffect(() => {
        const loadContent = async () => {
            setLoading(true);
            try {
                if (isImage || isVideo || isAudio || isPdf) {
                    const url = URL.createObjectURL(file.data);
                    setContent(url);
                } else if (isText) {
                    const text = await file.data.text();
                    setContent(text);
                }
            } catch (e) {
                console.error("Failed to load preview", e);
            } finally {
                setLoading(false);
            }
        };

        loadContent();

        return () => {
            if (content && (isImage || isVideo || isAudio || isPdf)) {
                URL.revokeObjectURL(content);
            }
        };
    }, [file]);

    const getIcon = () => {
        if (isImage) return <ImageIcon className="h-5 w-5 text-blue-600" />;
        if (isVideo) return <Film className="h-5 w-5 text-purple-600" />;
        if (isAudio) return <Music className="h-5 w-5 text-pink-600" />;
        if (isText || isPdf) return <FileText className="h-5 w-5 text-blue-600" />;
        return <File className="h-5 w-5 text-gray-600" />;
    };

    const renderPreview = () => {
        if (loading) {
            return (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
                    <p className="text-gray-500">Loading preview...</p>
                </div>
            );
        }

        // Image Preview
        if (isImage && content) {
            return (
                <div className="flex items-center justify-center bg-gray-900 rounded-lg p-4 h-full">
                    <img
                        src={content}
                        alt={file.name}
                        className="max-w-full max-h-full object-contain rounded shadow-lg"
                    />
                </div>
            );
        }

        // Video Preview
        if (isVideo && content) {
            return (
                <div className="flex items-center justify-center bg-black rounded-lg h-full">
                    <video
                        src={content}
                        controls
                        autoPlay
                        className="max-w-full max-h-full rounded"
                    >
                        Your browser does not support video playback.
                    </video>
                </div>
            );
        }

        // Audio Preview
        if (isAudio && content) {
            return (
                <div className="flex flex-col items-center justify-center h-64 gap-6">
                    <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                        <Music className="h-16 w-16 text-white" />
                    </div>
                    <p className="font-medium text-gray-700">{file.name}</p>
                    <audio src={content} controls autoPlay className="w-full max-w-md">
                        Your browser does not support audio playback.
                    </audio>
                </div>
            );
        }

        // PDF Preview
        if (isPdf && content) {
            return (
                <iframe
                    src={content}
                    className="w-full h-full rounded-lg border border-gray-200"
                    title="PDF Preview"
                />
            );
        }

        // Text Preview
        if (isText && content) {
            return (
                <div className="bg-gray-900 rounded-lg h-full overflow-auto">
                    <pre className="p-6 text-sm text-gray-100 font-mono whitespace-pre-wrap break-words">
                        {content}
                    </pre>
                </div>
            );
        }

        // Unsupported
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <File className="h-16 w-16 mb-4 text-gray-300" />
                <p className="font-medium">Preview not available for this file type</p>
                <p className="text-sm mt-2">Click Download to view the file</p>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all ${isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-5xl max-h-[90vh]'
                }`}>
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
                            {getIcon()}
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 truncate max-w-md">{file.name}</h3>
                            <p className="text-xs text-gray-500">{file.mimeType}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                        >
                            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                        </button>
                        <button
                            onClick={onDownload}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                        >
                            <Download className="h-4 w-4" />
                            Download
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className={`flex-1 overflow-auto bg-gray-100 p-6 ${isFullscreen ? 'h-[calc(100vh-80px)]' : 'h-[70vh]'
                    }`}>
                    {renderPreview()}
                </div>
            </div>
        </div>
    );
};
