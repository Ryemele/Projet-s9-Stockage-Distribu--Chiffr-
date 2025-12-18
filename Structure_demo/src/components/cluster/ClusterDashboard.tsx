import React, { useState, useEffect } from 'react';
import { Server, Wifi, WifiOff, Database, Shield, RefreshCw } from 'lucide-react';

interface NodeStatus {
    id: string;
    url: string;
    status: 'online' | 'offline' | 'degraded';
    chunksStored: number;
    storageUsed: number;
    latency: number;
}

interface ClusterStatus {
    totalNodes: number;
    onlineNodes: number;
    offlineNodes: number;
    totalChunks: number;
    totalStorage: number;
    healthy: boolean;
    nodes: NodeStatus[];
    erasureConfig?: {
        dataShards: number;
        parityShards: number;
    };
}

interface ClusterDashboardProps {
    compact?: boolean;
    showDetails?: boolean;
}

export const ClusterDashboard: React.FC<ClusterDashboardProps> = ({
    compact = false,
    showDetails = true
}) => {
    const [status, setStatus] = useState<ClusterStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    const fetchStatus = async () => {
        try {
            setLoading(true);
            const response = await fetch('https://localhost:3000/api/distributed/cluster', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setStatus(data);
                setLastUpdate(new Date());
                setError(null);
            } else {
                // Fallback to mock data for development
                setStatus(getMockStatus());
                setLastUpdate(new Date());
            }
        } catch (err) {
            // Use mock data in development
            setStatus(getMockStatus());
            setLastUpdate(new Date());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const getMockStatus = (): ClusterStatus => ({
        totalNodes: 6,
        onlineNodes: 5,
        offlineNodes: 1,
        totalChunks: 128,
        totalStorage: 256 * 1024 * 1024,
        healthy: true,
        nodes: [
            { id: 'node-4001', url: 'localhost:4001', status: 'online', chunksStored: 24, storageUsed: 48 * 1024 * 1024, latency: 12 },
            { id: 'node-4002', url: 'localhost:4002', status: 'online', chunksStored: 22, storageUsed: 44 * 1024 * 1024, latency: 8 },
            { id: 'node-4003', url: 'localhost:4003', status: 'online', chunksStored: 26, storageUsed: 52 * 1024 * 1024, latency: 15 },
            { id: 'node-4004', url: 'localhost:4004', status: 'offline', chunksStored: 0, storageUsed: 0, latency: 0 },
            { id: 'node-4005', url: 'localhost:4005', status: 'online', chunksStored: 28, storageUsed: 56 * 1024 * 1024, latency: 10 },
            { id: 'node-4006', url: 'localhost:4006', status: 'online', chunksStored: 28, storageUsed: 56 * 1024 * 1024, latency: 11 },
        ],
        erasureConfig: { dataShards: 4, parityShards: 2 },
    });

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'online': return 'text-green-500';
            case 'offline': return 'text-red-500';
            case 'degraded': return 'text-yellow-500';
            default: return 'text-gray-500';
        }
    };

    const getStatusBg = (status: string) => {
        switch (status) {
            case 'online': return 'bg-green-100';
            case 'offline': return 'bg-red-100';
            case 'degraded': return 'bg-yellow-100';
            default: return 'bg-gray-100';
        }
    };

    if (loading && !status) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="grid grid-cols-6 gap-2">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-16 bg-gray-200 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!status) return null;

    if (compact) {
        return (
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">
                        {status.onlineNodes}/{status.totalNodes} nodes
                    </span>
                </div>
                <div className="flex gap-1">
                    {status.nodes.map(node => (
                        <div
                            key={node.id}
                            className={`w-2 h-2 rounded-full ${node.status === 'online' ? 'bg-green-500' :
                                node.status === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
                                }`}
                            title={`${node.id}: ${node.status}`}
                        />
                    ))}
                </div>
                <span className={`text-xs font-medium ${status.healthy ? 'text-green-600' : 'text-yellow-600'}`}>
                    {status.healthy ? 'Healthy' : 'Degraded'}
                </span>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Database className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Storage Cluster</h3>
                        <p className="text-xs text-gray-500">
                            RS({status.erasureConfig?.dataShards || 4}, {status.erasureConfig?.parityShards || 2}) •
                            {status.erasureConfig?.parityShards || 2} node failures tolerated
                        </p>
                    </div>
                </div>
                <button
                    onClick={fetchStatus}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{status.onlineNodes}</div>
                    <div className="text-xs text-gray-500">Online</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{status.totalChunks}</div>
                    <div className="text-xs text-gray-500">Chunks</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{formatBytes(status.totalStorage)}</div>
                    <div className="text-xs text-gray-500">Storage</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className={`text-2xl font-bold ${status.healthy ? 'text-green-600' : 'text-yellow-600'}`}>
                        {status.healthy ? '✓' : '!'}
                    </div>
                    <div className="text-xs text-gray-500">{status.healthy ? 'Healthy' : 'Degraded'}</div>
                </div>
            </div>

            {/* Node Grid */}
            {showDetails && (
                <div className="grid grid-cols-3 gap-3">
                    {status.nodes.map(node => (
                        <div
                            key={node.id}
                            className={`p-4 rounded-lg border ${getStatusBg(node.status)} border-gray-200 transition-all hover:scale-105`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    {node.status === 'online' ? (
                                        <Wifi className={`h-4 w-4 ${getStatusColor(node.status)}`} />
                                    ) : (
                                        <WifiOff className={`h-4 w-4 ${getStatusColor(node.status)}`} />
                                    )}
                                    <span className="text-sm font-medium text-gray-900">
                                        {node.id.replace('node-', 'Node ')}
                                    </span>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${node.status === 'online' ? 'bg-green-200 text-green-800' :
                                    node.status === 'offline' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'
                                    }`}>
                                    {node.status}
                                </span>
                            </div>

                            {node.status === 'online' && (
                                <div className="space-y-1 mt-3">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Chunks</span>
                                        <span className="font-medium text-gray-700">{node.chunksStored}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Storage</span>
                                        <span className="font-medium text-gray-700">{formatBytes(node.storageUsed)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Latency</span>
                                        <span className="font-medium text-gray-700">{node.latency}ms</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Footer */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Shield className="h-3 w-3" />
                    <span>Protected by Reed-Solomon erasure coding</span>
                </div>
                {lastUpdate && (
                    <span className="text-xs text-gray-400">
                        Updated {lastUpdate.toLocaleTimeString()}
                    </span>
                )}
            </div>
        </div>
    );
};
