/**
 * Admin Dashboard - Full System Monitoring
 * 
 * Features:
 * - Node Control (check/stop)
 * - Chunk Distribution
 * - Statistics with graphs
 * - System Logs
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Activity,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Server,
    HardDrive,
    Clock,
    RefreshCw,
    Database,
    Wifi,
    WifiOff,
    Square,
    ChevronDown,
    ChevronUp,
    FileText,
    Box,
    Eye,
    BarChart3,
    ScrollText,
    TrendingUp,
    Cpu,
    MemoryStick,
    AlertCircle,
    Info,
} from 'lucide-react';

interface NodeHealth {
    id: string;
    url: string;
    status: 'online' | 'offline' | 'degraded';
    chunksStored: number;
    storageUsed: number;
    latency: number;
    health?: {
        nodeId: string;
        chunksStored: number;
        storageUsedBytes: number;
        uptime: number;
        startTime: string;
    };
}

interface Chunk {
    id: string;
    shardIndex: number;
    fileId: string;
    fileName: string;
    ownerEmail?: string;
    isData: boolean;
    size: number;
    stored: boolean;
    verified: boolean;
    createdAt: string;
}

interface ClusterHealth {
    timestamp: string;
    totalNodes: number;
    onlineNodes: number;
    offlineNodes: number;
    healthy: boolean;
    nodes: NodeHealth[];
}

interface LogEntry {
    id: string;
    timestamp: Date;
    level: 'info' | 'warn' | 'error';
    source: string;
    message: string;
}

interface UptimeHistory {
    nodeId: string;
    uptimes: number[];
    timestamps: string[];
}

export const AdminDashboard: React.FC = () => {
    const [clusterHealth, setClusterHealth] = useState<ClusterHealth | null>(null);
    const [nodeChunks, setNodeChunks] = useState<{ [key: string]: Chunk[] }>({});
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [controllingNode, setControllingNode] = useState<string | null>(null);
    const [selectedTab, setSelectedTab] = useState<'nodes' | 'chunks' | 'stats' | 'logs'>('nodes');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [uptimeHistory, setUptimeHistory] = useState<UptimeHistory[]>([]);

    const getAuthHeaders = () => {
        const token = localStorage.getItem('authToken');
        return { 'Authorization': `Bearer ${token}` };
    };

    const addLog = useCallback((level: 'info' | 'warn' | 'error', source: string, message: string) => {
        const newLog: LogEntry = {
            id: Date.now().toString(),
            timestamp: new Date(),
            level,
            source,
            message
        };
        setLogs(prev => [newLog, ...prev].slice(0, 100)); // Keep last 100 logs
    }, []);

    const fetchClusterHealth = useCallback(async () => {
        try {
            const response = await fetch('/api/distributed/health', {
                headers: getAuthHeaders()
            });
            if (response.ok) {
                const data = await response.json();
                setClusterHealth(data);

                // Update uptime history
                if (data.nodes) {
                    setUptimeHistory(prev => {
                        const newHistory = [...prev];
                        data.nodes.forEach((node: NodeHealth) => {
                            const existingIdx = newHistory.findIndex(h => h.nodeId === node.id);
                            const uptime = node.health?.uptime || 0;
                            const now = new Date().toLocaleTimeString();

                            if (existingIdx >= 0) {
                                newHistory[existingIdx].uptimes.push(uptime);
                                newHistory[existingIdx].timestamps.push(now);
                                // Keep last 30 data points
                                if (newHistory[existingIdx].uptimes.length > 30) {
                                    newHistory[existingIdx].uptimes.shift();
                                    newHistory[existingIdx].timestamps.shift();
                                }
                            } else {
                                newHistory.push({
                                    nodeId: node.id,
                                    uptimes: [uptime],
                                    timestamps: [now]
                                });
                            }
                        });
                        return newHistory;
                    });
                }

                addLog('info', 'Cluster', `Health check: ${data.onlineNodes}/${data.totalNodes} nodes online`);
            }
        } catch (error) {
            console.error('Error fetching cluster health:', error);
            addLog('error', 'Cluster', 'Failed to fetch cluster health');
        }
    }, [addLog]);

    const fetchAllChunks = useCallback(async () => {
        try {
            const response = await fetch('/api/distributed/all-chunks', {
                headers: getAuthHeaders()
            });
            if (response.ok) {
                const data = await response.json();
                setNodeChunks(data.nodeChunks || {});
            }
        } catch (error) {
            console.error('Error fetching chunks:', error);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        await Promise.all([fetchClusterHealth(), fetchAllChunks()]);
        setLastUpdate(new Date());
        setLoading(false);
    }, [fetchClusterHealth, fetchAllChunks]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchData]);

    const controlNode = async (nodeId: string, action: 'check' | 'stop' | 'restart') => {
        setControllingNode(nodeId);
        addLog('info', nodeId, `Action: ${action}`);
        try {
            const response = await fetch(`/api/distributed/nodes/${nodeId}/control`, {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action })
            });
            if (response.ok) {
                const result = await response.json();
                addLog('info', nodeId, `${action} completed - status: ${result.status || 'ok'}`);
                await fetchClusterHealth();
            }
        } catch (error) {
            addLog('error', nodeId, `${action} failed: ${error}`);
        }
        setControllingNode(null);
    };

    const toggleNodeExpand = (nodeId: string) => {
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(nodeId)) {
            newExpanded.delete(nodeId);
        } else {
            newExpanded.add(nodeId);
        }
        setExpandedNodes(newExpanded);
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatUptime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) return `${hours}h ${mins}m`;
        if (mins > 0) return `${mins}m ${secs}s`;
        return `${secs}s`;
    };

    const getNodePort = (nodeId: string) => {
        const match = nodeId.match(/\d+$/);
        return match ? match[0] : nodeId;
    };

    // Calculate cluster statistics
    const totalChunks = Object.values(nodeChunks).flat().length;
    const totalStorage = clusterHealth?.nodes.reduce((acc, n) => acc + n.storageUsed, 0) || 0;
    const avgLatency = clusterHealth?.nodes.filter(n => n.latency > 0).reduce((acc, n, _, arr) => acc + n.latency / arr.length, 0) || 0;

    return (
        <div className="space-y-6">
            {/* Header with gradient */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-black rounded-2xl p-8 text-white">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-blue-500/10"></div>
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-green-500/20 rounded-full blur-3xl"></div>

                <div className="relative flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                            <Server className="h-8 w-8" />
                            Admin Panel
                        </h1>
                        <p className="text-white/60">Distributed Storage Cluster Monitoring</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right text-sm text-white/60">
                            <div>Last updated</div>
                            <div className="font-medium text-white">{lastUpdate.toLocaleTimeString()}</div>
                        </div>
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className={`p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-all ${loading ? 'animate-spin' : ''}`}
                        >
                            <RefreshCw className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            className={`px-4 py-3 rounded-xl font-medium transition-all ${autoRefresh
                                ? 'bg-green-500 text-white'
                                : 'bg-white/10 text-white/60'
                                }`}
                        >
                            {autoRefresh ? 'Auto' : 'Manual'}
                        </button>
                    </div>
                </div>

                {/* Cluster Status Bar */}
                {clusterHealth && (
                    <div className="mt-6 flex items-center gap-6">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${clusterHealth.healthy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                            {clusterHealth.healthy ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                            <span className="font-semibold">{clusterHealth.healthy ? 'Cluster Healthy' : 'Cluster Degraded'}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                                <Wifi className="h-4 w-4 text-green-400" />
                                {clusterHealth.onlineNodes} online
                            </span>
                            <span className="flex items-center gap-1">
                                <WifiOff className="h-4 w-4 text-red-400" />
                                {clusterHealth.offlineNodes} offline
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1 w-fit">
                <button
                    onClick={() => setSelectedTab('nodes')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${selectedTab === 'nodes' ? 'bg-white shadow text-slate-900' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Server className="h-4 w-4" />
                    Nodes
                </button>
                <button
                    onClick={() => setSelectedTab('chunks')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${selectedTab === 'chunks' ? 'bg-white shadow text-slate-900' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Box className="h-4 w-4" />
                    Chunks
                </button>
                <button
                    onClick={() => setSelectedTab('stats')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${selectedTab === 'stats' ? 'bg-white shadow text-slate-900' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <BarChart3 className="h-4 w-4" />
                    Statistics
                </button>
                <button
                    onClick={() => setSelectedTab('logs')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${selectedTab === 'logs' ? 'bg-white shadow text-slate-900' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <ScrollText className="h-4 w-4" />
                    Logs
                </button>
            </div>

            {/* Statistics Tab */}
            {selectedTab === 'stats' && (
                <div className="space-y-6">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl border border-gray-200 p-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                                    <Server className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-gray-900">{clusterHealth?.onlineNodes || 0}/{clusterHealth?.totalNodes || 0}</div>
                                    <div className="text-sm text-gray-500">Nodes Online</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-200 p-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                                    <Box className="h-6 w-6 text-purple-600" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-gray-900">{totalChunks}</div>
                                    <div className="text-sm text-gray-500">Total Chunks</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-200 p-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                                    <HardDrive className="h-6 w-6 text-green-600" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-gray-900">{formatBytes(totalStorage)}</div>
                                    <div className="text-sm text-gray-500">Total Storage</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-200 p-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                                    <Activity className="h-6 w-6 text-orange-600" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-gray-900">{avgLatency.toFixed(0)}ms</div>
                                    <div className="text-sm text-gray-500">Avg Latency</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Uptime Charts */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                            Node Uptime
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {clusterHealth?.nodes.map((node) => (
                                <div key={node.id} className="bg-gray-50 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-medium text-gray-700">Node {getNodePort(node.id)}</span>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${node.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {node.status}
                                        </span>
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900 mb-1">
                                        {node.health?.uptime ? formatUptime(node.health.uptime) : 'N/A'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        Started: {node.health?.startTime ? new Date(node.health.startTime).toLocaleString() : 'N/A'}
                                    </div>
                                    {/* Mini bar chart */}
                                    <div className="mt-3 flex items-end gap-1 h-12">
                                        {uptimeHistory.find(h => h.nodeId === node.id)?.uptimes.slice(-10).map((_, idx, arr) => (
                                            <div
                                                key={idx}
                                                className="flex-1 bg-green-400 rounded-t transition-all"
                                                style={{ height: `${(node.status === 'online' ? 100 : 0)}%`, minHeight: '4px' }}
                                            />
                                        )) || Array(10).fill(0).map((_, idx) => (
                                            <div key={idx} className="flex-1 bg-gray-200 rounded-t h-1" />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Storage Distribution */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Database className="h-5 w-5 text-blue-600" />
                            Storage Distribution
                        </h3>
                        <div className="space-y-4">
                            {clusterHealth?.nodes.map((node) => {
                                const chunks = nodeChunks[node.id]?.length || 0;
                                const maxChunks = Math.max(...Object.values(nodeChunks).map(c => c.length), 1);
                                const percentage = (chunks / maxChunks) * 100;
                                return (
                                    <div key={node.id}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-700">Node {getNodePort(node.id)}</span>
                                            <span className="text-sm text-gray-500">{chunks} chunks • {formatBytes(node.storageUsed)}</span>
                                        </div>
                                        <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all rounded-full ${node.status === 'online' ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gray-300'
                                                    }`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Logs Tab */}
            {selectedTab === 'logs' && (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <ScrollText className="h-5 w-5" />
                            System Logs
                        </h2>
                        <button
                            onClick={() => setLogs([])}
                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
                        >
                            Clear Logs
                        </button>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                        {logs.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <ScrollText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                <p className="text-lg font-medium">No logs yet</p>
                                <p className="text-sm mt-1">Logs will appear here as the system operates</p>
                            </div>
                        ) : (
                            logs.map((log) => (
                                <div key={log.id} className="p-4 hover:bg-gray-50 flex items-start gap-4">
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${log.level === 'error' ? 'bg-red-100 text-red-600' :
                                        log.level === 'warn' ? 'bg-yellow-100 text-yellow-600' :
                                            'bg-blue-100 text-blue-600'
                                        }`}>
                                        {log.level === 'error' ? <AlertCircle className="h-4 w-4" /> :
                                            log.level === 'warn' ? <AlertTriangle className="h-4 w-4" /> :
                                                <Info className="h-4 w-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-gray-900">{log.source}</span>
                                            <span className="text-xs text-gray-400">
                                                {log.timestamp.toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600">{log.message}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Node Control Tab */}
            {selectedTab === 'nodes' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {clusterHealth?.nodes.map((node) => (
                        <div
                            key={node.id}
                            className={`bg-white rounded-2xl border-2 transition-all ${node.status === 'online'
                                ? 'border-green-200'
                                : node.status === 'degraded'
                                    ? 'border-yellow-200'
                                    : 'border-red-200'
                                }`}
                        >
                            {/* Node Header */}
                            <div className="p-5 border-b border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${node.status === 'online'
                                            ? 'bg-green-100'
                                            : node.status === 'degraded'
                                                ? 'bg-yellow-100'
                                                : 'bg-red-100'
                                            }`}>
                                            <Server className={`h-6 w-6 ${node.status === 'online'
                                                ? 'text-green-600'
                                                : node.status === 'degraded'
                                                    ? 'text-yellow-600'
                                                    : 'text-red-600'
                                                }`} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">Node {getNodePort(node.id)}</h3>
                                            <p className="text-sm text-gray-500">{node.url}</p>
                                        </div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${node.status === 'online'
                                        ? 'bg-green-100 text-green-700'
                                        : node.status === 'degraded'
                                            ? 'bg-yellow-100 text-yellow-700'
                                            : 'bg-red-100 text-red-700'
                                        }`}>
                                        {node.status}
                                    </div>
                                </div>
                            </div>

                            {/* Node Stats */}
                            <div className="p-5 grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-2">
                                    <Database className="h-4 w-4 text-gray-400" />
                                    <div>
                                        <div className="text-sm text-gray-500">Chunks</div>
                                        <div className="font-semibold text-gray-900">{node.chunksStored}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <HardDrive className="h-4 w-4 text-gray-400" />
                                    <div>
                                        <div className="text-sm text-gray-500">Storage</div>
                                        <div className="font-semibold text-gray-900">{formatBytes(node.storageUsed)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-gray-400" />
                                    <div>
                                        <div className="text-sm text-gray-500">Latency</div>
                                        <div className="font-semibold text-gray-900">
                                            {node.latency > 0 ? `${node.latency}ms` : 'N/A'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-gray-400" />
                                    <div>
                                        <div className="text-sm text-gray-500">Uptime</div>
                                        <div className="font-semibold text-gray-900">
                                            {node.health?.uptime ? formatUptime(node.health.uptime) : 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Node Controls */}
                            <div className="p-5 pt-0 flex gap-2">
                                <button
                                    onClick={() => controlNode(node.id, 'check')}
                                    disabled={controllingNode === node.id}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all font-medium"
                                >
                                    <Eye className="h-4 w-4" />
                                    Check
                                </button>
                                <button
                                    onClick={() => controlNode(node.id, 'stop')}
                                    disabled={controllingNode === node.id || node.status === 'offline'}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all font-medium disabled:opacity-50"
                                >
                                    <Square className="h-4 w-4" />
                                    Stop
                                </button>
                                <button
                                    onClick={() => toggleNodeExpand(node.id)}
                                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-all"
                                >
                                    {expandedNodes.has(node.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                            </div>

                            {/* Expanded Chunks View */}
                            {expandedNodes.has(node.id) && (
                                <div className="border-t border-gray-100 p-5 bg-gray-50 rounded-b-2xl">
                                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                        <Box className="h-4 w-4" />
                                        Stored Chunks ({nodeChunks[node.id]?.length || 0})
                                    </h4>
                                    {nodeChunks[node.id]?.length > 0 ? (
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {nodeChunks[node.id].map((chunk, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${chunk.isData ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                                                            }`}>
                                                            {chunk.isData ? 'D' : 'P'}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-gray-900 text-sm truncate max-w-[150px]">
                                                                {chunk.fileName}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                Shard #{chunk.shardIndex} • {formatBytes(chunk.size)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {chunk.stored && <CheckCircle className="h-4 w-4 text-green-500" />}
                                                        {chunk.verified && <CheckCircle className="h-4 w-4 text-blue-500" />}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-gray-500">
                                            <Box className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p>No chunks stored</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Chunk Distribution Tab */}
            {selectedTab === 'chunks' && (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-xl font-bold text-gray-900">Chunk Distribution Across Nodes</h2>
                        <p className="text-gray-500 mt-1">Visualize how file chunks are distributed across storage nodes</p>
                    </div>

                    {/* Visual Grid */}
                    <div className="p-6">
                        <div className="grid grid-cols-6 gap-4 mb-8">
                            {clusterHealth?.nodes.map((node) => (
                                <div key={node.id} className="text-center">
                                    <div className={`w-full h-32 rounded-xl flex flex-col items-center justify-center gap-2 ${node.status === 'online'
                                        ? 'bg-gradient-to-br from-green-100 to-emerald-100 border-2 border-green-300'
                                        : 'bg-gray-100 border-2 border-gray-300'
                                        }`}>
                                        <Server className={`h-8 w-8 ${node.status === 'online' ? 'text-green-600' : 'text-gray-400'
                                            }`} />
                                        <div className="text-2xl font-bold text-gray-900">
                                            {nodeChunks[node.id]?.length || 0}
                                        </div>
                                        <div className="text-xs text-gray-500">chunks</div>
                                    </div>
                                    <div className="mt-2 font-medium text-gray-700">
                                        Node {getNodePort(node.id)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Chunk Legend */}
                        <div className="flex items-center gap-6 justify-center mb-6">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded bg-blue-500"></div>
                                <span className="text-sm text-gray-600">Data Shard</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded bg-purple-500"></div>
                                <span className="text-sm text-gray-600">Parity Shard</span>
                            </div>
                        </div>

                        {/* Chunk Table */}
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">File</th>
                                        <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Owner</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Type</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Node</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Shard #</th>
                                        <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Size</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {Object.entries(nodeChunks).flatMap(([nodeId, chunks]) =>
                                        chunks.map((chunk, idx) => (
                                            <tr key={`${nodeId}-${idx}`} className="hover:bg-gray-50">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="h-4 w-4 text-gray-400" />
                                                        <span className="font-medium text-gray-900 truncate max-w-[200px]">
                                                            {chunk.fileName}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 text-sm">
                                                    {chunk.ownerEmail || 'Unknown'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${chunk.isData
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-purple-100 text-purple-700'
                                                        }`}>
                                                        {chunk.isData ? 'DATA' : 'PARITY'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center font-medium text-gray-700">
                                                    {getNodePort(nodeId)}
                                                </td>
                                                <td className="px-4 py-3 text-center text-gray-600">
                                                    #{chunk.shardIndex}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-600">
                                                    {formatBytes(chunk.size)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {chunk.stored ? (
                                                        <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                                                    ) : (
                                                        <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {Object.values(nodeChunks).flat().length === 0 && (
                                <div className="p-12 text-center text-gray-500">
                                    <Box className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                    <p className="text-lg font-medium">No chunks distributed yet</p>
                                    <p className="text-sm mt-1">Upload a file to see chunk distribution</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
