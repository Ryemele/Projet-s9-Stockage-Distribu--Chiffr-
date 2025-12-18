import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  FileIcon,
  HardDrive,
} from "lucide-react";
import type { EncryptedFile } from "../types";
import { FileTable } from "../components/files/FileTable";
import { ClusterDashboard } from "../components/cluster/ClusterDashboard";
import { apiService } from "../services/apiService";
import { calculateStorageByCategory } from "../utils/fileCategories";
import { useAuth } from "../contexts/AuthContext";

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [isDragging, setIsDragging] = useState(false);
  const [recentFiles, setRecentFiles] = useState<EncryptedFile[]>([]);
  const [loading, setLoading] = useState(true);

  // Load files from API
  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const files = await apiService.getFiles();
      // Sort by upload date and get last 5
      const sorted = files
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
        .slice(0, 5);
      setRecentFiles(sorted);
    } catch (err) {
      console.error("Failed to load files:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    navigate("/upload");
  };

  const handleDeleteFile = async (file: EncryptedFile) => {
    if (confirm(`Delete "${file.name}"?`)) {
      try {
        await apiService.deleteFile(file.id);
        loadFiles(); // Refresh the list
      } catch (err) {
        console.error("Failed to delete file:", err);
        alert("Failed to delete file");
      }
    }
  };

  const handleDownloadFile = (_file: EncryptedFile) => {
    navigate("/files"); // Redirect to files page for download
  };

  const handleShareFile = (_file: EncryptedFile) => {
    navigate("/files"); // Redirect to files page for sharing
  };

  // Calculate storage stats from real files
  const storageByCategory = calculateStorageByCategory(recentFiles);
  const totalStorage = recentFiles.reduce((sum, f) => sum + f.size, 0);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Create segments for storage chart
  const segments = Object.entries(storageByCategory)
    .filter(([_, data]) => data.size > 0)
    .map(([key, data]) => ({
      key,
      ...data,
      percentage: totalStorage > 0 ? (data.size / totalStorage) * 100 : 0,
    }));

  return (
    <div className="space-y-8">
      {/* Hero Section with Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-xl transition-all duration-300 ${isDragging
          ? "bg-primary-50 border-2 border-primary-400 border-dashed"
          : "bg-gradient-to-br from-primary-600 via-primary-500 to-secondary-400"
          }`}
      >
        <div className="relative z-10 px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-1">
                {isDragging ? "Drop files to upload" : "Welcome to SecureBox!"}
              </h1>
              <p className="text-white/90 text-sm">
                {isDragging
                  ? "Release to start uploading your files securely"
                  : "Your secure, encrypted file storage solution"}
              </p>
            </div>

            {!isDragging && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("/upload")}
                  className="px-5 py-2.5 bg-white text-primary-600 font-semibold rounded-lg hover:bg-white/90 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 text-sm"
                >
                  <Upload className="h-4 w-4" />
                  Upload Files
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary-400/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"></div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Files Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Overview</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-secondary-50 rounded-lg flex items-center justify-center">
                <FileIcon className="h-5 w-5 text-secondary-400" />
              </div>
              <span className="text-sm text-gray-600">My Files</span>
            </div>
            <span className="text-xl font-bold text-gray-900">
              {recentFiles.length}
            </span>
          </div>
        </div>

        {/* Storage by Category Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Storage</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatSize(totalStorage)}
                  </p>
                </div>
              </div>

              {/* Storage Categories Legend */}
              <div className="space-y-1.5">
                {segments.map((segment) => (
                  <div
                    key={segment.key}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: segment.color }}
                      />
                      <span className="text-gray-600">{segment.label}</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      {formatSize(segment.size)}
                    </span>
                  </div>
                ))}
                {segments.length === 0 && (
                  <p className="text-gray-500 text-xs">No files uploaded yet</p>
                )}
              </div>
            </div>

            {/* Circular Chart */}
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg className="transform -rotate-90" viewBox="0 0 100 100">
                {segments.length > 0 ? (
                  (() => {
                    let currentAngle = 0;
                    return segments.map((segment) => {
                      const angle = (segment.percentage / 100) * 360;
                      const startAngle = currentAngle;
                      currentAngle += angle;

                      const radius = 40;
                      const centerX = 50;
                      const centerY = 50;

                      const startRad = (startAngle * Math.PI) / 180;
                      const endRad = (currentAngle * Math.PI) / 180;

                      const x1 = centerX + radius * Math.cos(startRad);
                      const y1 = centerY + radius * Math.sin(startRad);
                      const x2 = centerX + radius * Math.cos(endRad);
                      const y2 = centerY + radius * Math.sin(endRad);

                      const largeArc = angle > 180 ? 1 : 0;

                      return (
                        <path
                          key={segment.key}
                          d={`M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                          fill={segment.color}
                          className="transition-opacity hover:opacity-80"
                        />
                      );
                    });
                  })()
                ) : (
                  <circle cx="50" cy="50" r="40" fill="#e5e7eb" />
                )}
                <circle cx="50" cy="50" r="25" fill="white" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <HardDrive className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Storage Cluster Status - Admin Only */}
      {isAdmin && <ClusterDashboard />}

      {/* Recent Files Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Recent Files</h2>
            <p className="text-sm text-gray-600 mt-1">Your latest uploads</p>
          </div>
          <button
            onClick={() => navigate("/files")}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            View all →
          </button>
        </div>

        <FileTable
          files={recentFiles.map((file) => ({
            ...file,
            encrypted: true,
          }))}
          loading={loading}
          onDelete={handleDeleteFile}
          onDownload={handleDownloadFile}
          onShare={handleShareFile}
        />
      </div>
    </div>
  );
};
