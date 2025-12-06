import React, { useEffect, useState } from 'react';
import { X, Download, FileText, Image as ImageIcon, File } from 'lucide-react';


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

    useEffect(() => {
        const loadContent = async () => {
            setLoading(true);
            try {
                if (file.mimeType.startsWith('image/')) {
                    const url = URL.createObjectURL(file.data);
                    setContent(url);
                } else if (file.mimeType.startsWith('text/')) {
                    const text = await file.data.text();
                    // Sanitize text content to prevent XSS if rendering as HTML (though we render as text)
                    // But just to be safe if we ever change to innerHTML
                    setContent(text);
                } else if (file.mimeType === 'application/pdf') {
                    const url = URL.createObjectURL(file.data);
                    setContent(url);
                }
            } catch (e) {
                console.error("Failed to load preview", e);
            } finally {
                setLoading(false);
            }
        };

        loadContent();

        return () => {
            if (content && (file.mimeType.startsWith('image/') || file.mimeType === 'application/pdf')) {
                URL.revokeObjectURL(content);
            }
        };
    }, [file]);

    const renderPreview = () => {
        if (loading) {
            return <div className="flex items-center justify-center h-64">Loading preview...</div>;
        }

        if (file.mimeType.startsWith('image/') && content) {
            return (
                <div className="flex items-center justify-center bg-gray-100 rounded-lg p-4 h-[60vh]">
                    <img src={content} alt={file.name} className="max-w-full max-h-full object-contain" />
                </div>
            );
        }

        if (file.mimeType.startsWith('text/') && content) {
            return (
                <div className="bg-gray-50 rounded-lg p-4 h-[60vh] overflow-auto border border-gray-200 font-mono text-sm whitespace-pre-wrap">
                    {content}
                </div>
            );
        }

        if (file.mimeType === 'application/pdf' && content) {
            return (
                <iframe src={content} className="w-full h-[60vh] rounded-lg border border-gray-200" title="PDF Preview" />
            );
        }

        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <File className="h-16 w-16 mb-4 text-gray-300" />
                <p>Preview not available for this file type.</p>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-3">
                        {file.mimeType.startsWith('image/') ? <ImageIcon className="h-5 w-5 text-blue-600" /> :
                            file.mimeType.startsWith('text/') ? <FileText className="h-5 w-5 text-blue-600" /> :
                                <File className="h-5 w-5 text-blue-600" />}
                        <h3 className="font-semibold text-gray-900 truncate max-w-md">{file.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onDownload}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                            title="Download"
                        >
                            <Download className="h-5 w-5" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                            title="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-auto">
                    {renderPreview()}
                </div>
            </div>
        </div>
    );
};
