import React, { useState, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { fileProcessingService } from "../../services/fileProcessingService";
import type { ProcessedFile, FileProcessingProgress } from "../../types/crypto";
import { apiService } from "../../services/apiService";
import { Alert } from "../ui";
import { Upload, File, X, Shield, Lock, Layers } from "lucide-react";

/**
 * Enhanced File Upload Component
 *
 * Features:
 * - Real client-side encryption (AES-GCM)
 * - File chunking for distributed storage
 * - Progress tracking per file
 * - End-to-end encryption: only the client sees plaintext data
 */

interface UploadingFile {
  file: File;
  status: "pending" | "chunking" | "encrypting" | "uploading" | "completed" | "error";
  progress: number;
  statusMessage: string;
  error?: string;
  processedFile?: ProcessedFile;
  chunksCount?: number;
}

export const FileUploadEnhanced: React.FC<{
  onUploadComplete?: () => void;
}> = ({ onUploadComplete }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<
    Map<string, UploadingFile>
  >(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { masterKey } = useAuth();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
      setError("");
      setSuccess("");

      // Initialize upload status for each file
      const newMap = new Map<string, UploadingFile>();
      files.forEach((file) => {
        newMap.set(file.name, {
          file,
          status: "pending",
          progress: 0,
          statusMessage: "Waiting...",
        });
      });
      setUploadingFiles(newMap);
    }
  };

  const removeFile = (fileName: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.name !== fileName));
    setUploadingFiles((prev) => {
      const newMap = new Map(prev);
      newMap.delete(fileName);
      return newMap;
    });
  };

  const updateFileStatus = (
    fileName: string,
    updates: Partial<UploadingFile>
  ) => {
    setUploadingFiles((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(fileName);
      if (current) {
        newMap.set(fileName, { ...current, ...updates });
      }
      return newMap;
    });
  };

  const handleUpload = async () => {
    if (!masterKey) {
      setError("Master key not available. Please log in again.");
      return;
    }

    if (selectedFiles.length === 0) {
      setError("Please select at least one file");
      return;
    }

    setIsUploading(true);
    setError("");
    setSuccess("");

    try {
      // Upload files sequentially
      for (const file of selectedFiles) {
        try {
          console.log(`[Upload] Starting processing for: ${file.name}`);

          updateFileStatus(file.name, {
            status: "chunking",
            statusMessage: "Découpage du fichier...",
            progress: 0,
          });

          // Process file: chunk + encrypt
          const processedFile = await fileProcessingService.processFileForUpload(
            file,
            {
              masterKey,
              onProgress: (progress: FileProcessingProgress) => {
                // Map stage to status
                let status: UploadingFile["status"] = "chunking";
                if (progress.stage === "encrypting") status = "encrypting";
                else if (progress.stage === "uploading") status = "uploading";
                else if (progress.stage === "complete") status = "completed";
                else if (progress.stage === "error") status = "error";

                updateFileStatus(file.name, {
                  status,
                  progress: progress.overallProgress,
                  statusMessage: progress.message,
                });
              },
            }
          );

          console.log(
            `[Upload] Processing complete. File ID: ${processedFile.metadata.fileId}, Chunks: ${processedFile.chunks.length}`
          );

          updateFileStatus(file.name, {
            status: "uploading",
            statusMessage: `Uploading ${processedFile.chunks.length} chunks...`,
            progress: 95,
            processedFile,
            chunksCount: processedFile.chunks.length,
          });

          // Prepare data for API
          const uploadData = {
            fileId: processedFile.metadata.fileId,
            fileName: processedFile.metadata.fileName,
            fileSize: processedFile.metadata.totalSize,
            mimeType: processedFile.metadata.mimeType,
            totalChunks: processedFile.metadata.totalChunks,
            chunkSize: processedFile.metadata.chunkSize,
            fileHash: processedFile.metadata.fileHash,
            encryptionVersion: processedFile.metadata.encryptionVersion,
            algorithm: processedFile.metadata.algorithm,
            // Serialize metadata and chunks for storage
            metadata: fileProcessingService.serializeMetadata(processedFile.metadata),
            chunks: processedFile.chunks.map(chunk => 
              fileProcessingService.serializeChunk(chunk)
            ),
          };

          // Upload to server
          await apiService.uploadFile(uploadData);

          console.log(`[Upload] Upload complete for: ${file.name}`);

          updateFileStatus(file.name, {
            status: "completed",
            statusMessage: `Upload complete! (${processedFile.chunks.length} chunks)`,
            progress: 100,
          });
        } catch (fileError) {
          console.error(`[Upload] Error for ${file.name}:`, fileError);
          updateFileStatus(file.name, {
            status: "error",
            statusMessage: "Upload failed",
            error:
              fileError instanceof Error ? fileError.message : "Unknown error",
          });
        }
      }

      setSuccess(`Successfully uploaded ${selectedFiles.length} file(s) with end-to-end encryption`);
      setSelectedFiles([]);

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (err) {
      console.error("[Upload] General error:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const getStatusColor = (status: UploadingFile["status"]) => {
    switch (status) {
      case "completed":
        return "text-green-600";
      case "error":
        return "text-red-600";
      case "chunking":
      case "encrypting":
      case "uploading":
        return "text-primary-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = (status: UploadingFile["status"]) => {
    switch (status) {
      case "chunking":
        return <Layers className="w-4 h-4" />;
      case "encrypting":
        return <Lock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Encryption Info */}
      <div className="bg-primary-50/50 border border-blue-100 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">End-to-end encrypted</h3>
            <p className="text-sm text-gray-600 mt-0.5">
              Your files are chunked and encrypted client-side with AES-256-GCM before upload.
              Only you can decrypt them.
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3" /> Chunking: 1 MB
              </span>
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3" /> AES-256-GCM
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* File Input */}
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-400 hover:bg-primary-50/30 transition-all duration-200">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-50 rounded-full mb-4">
          <Upload className="h-8 w-8 text-primary-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          Drop files here to upload
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          or{" "}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="font-medium text-primary-600 hover:text-blue-500 hover:underline"
            disabled={isUploading}
          >
            browse from your computer
          </button>
        </p>
        <p className="text-xs text-gray-500">
          Multiple files supported • Max 5 GB per file
        </p>
      </div>

      {/* Selected Files */}
      {uploadingFiles.size > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              {uploadingFiles.size}{" "}
              {uploadingFiles.size === 1 ? "file" : "files"} selected
            </h3>
          </div>

          {Array.from(uploadingFiles.values()).map((uploadFile) => (
            <div
              key={uploadFile.file.name}
              className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-200">
                    <File className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatFileSize(uploadFile.file.size)}
                    </p>

                    {/* Status */}
                    <div className={`flex items-center gap-1.5 text-xs mt-2 font-medium ${getStatusColor(
                        uploadFile.status
                      )}`}
                    >
                      {getStatusIcon(uploadFile.status)}
                      <span>
                        {uploadFile.statusMessage}
                        {uploadFile.error && ` - ${uploadFile.error}`}
                      </span>
                    </div>

                    {/* Chunks info */}
                    {uploadFile.chunksCount && uploadFile.status === "completed" && (
                      <p className="text-xs text-gray-500 mt-1">
                        {uploadFile.chunksCount} encrypted chunk{uploadFile.chunksCount > 1 ? 's' : ''} created
                      </p>
                    )}

                    {/* Progress Bar */}
                    {(uploadFile.status === "chunking" ||
                      uploadFile.status === "encrypting" ||
                      uploadFile.status === "uploading") && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-primary-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${uploadFile.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1.5">
                          {uploadFile.progress}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {uploadFile.status === "pending" && (
                  <button
                    onClick={() => removeFile(uploadFile.file.name)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error/Success Messages */}
      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      {/* Upload Button */}
      {selectedFiles.length > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            {selectedFiles.length}{" "}
            {selectedFiles.length === 1 ? "file" : "files"} ready to upload
          </p>
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
          >
            {isUploading
              ? "Uploading..."
              : `Upload ${selectedFiles.length === 1 ? "File" : "Files"}`}
          </button>
        </div>
      )}
    </div>
  );
};
