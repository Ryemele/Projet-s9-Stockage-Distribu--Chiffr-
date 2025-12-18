/**
 * Frontend Component Test Suite
 * 
 * Tests: ErrorBoundary, ClusterDashboard, FileUpload
 * Run with: npm test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ==================== ERROR BOUNDARY TESTS ====================

describe('ErrorBoundary', () => {
    // Suppress console.error for error boundary tests
    const originalError = console.error;
    beforeEach(() => { console.error = vi.fn(); });
    afterEach(() => { console.error = originalError; });

    describe('Normal Rendering', () => {
        it('should render children when no error', () => {
            const { container } = render(
                <ErrorBoundary>
                    <div data-testid="child">Hello World</div>
                </ErrorBoundary>
            );

            expect(screen.getByTestId('child')).toBeTruthy();
        });

        it('should pass through all props to children', () => {
            const { container } = render(
                <ErrorBoundary>
                    <ChildComponent message="test" />
                </ErrorBoundary>
            );

            expect(screen.getByText('test')).toBeTruthy();
        });
    });

    describe('Error Handling', () => {
        it('should catch errors and show fallback UI', () => {
            const { container } = render(
                <ErrorBoundary>
                    <ThrowingComponent />
                </ErrorBoundary>
            );

            expect(screen.getByText(/Something went wrong/i)).toBeTruthy();
        });

        it('should show error details in development', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const { container } = render(
                <ErrorBoundary>
                    <ThrowingComponent errorMessage="Test error message" />
                </ErrorBoundary>
            );

            expect(screen.getByText(/Test error message/i)).toBeTruthy();

            process.env.NODE_ENV = originalEnv;
        });

        it('should hide error details in production', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const { container } = render(
                <ErrorBoundary>
                    <ThrowingComponent errorMessage="Secret error" />
                </ErrorBoundary>
            );

            expect(screen.queryByText(/Secret error/i)).toBeNull();

            process.env.NODE_ENV = originalEnv;
        });

        it('should call onError callback when provided', () => {
            const onError = vi.fn();

            render(
                <ErrorBoundary onError={onError}>
                    <ThrowingComponent />
                </ErrorBoundary>
            );

            expect(onError).toHaveBeenCalled();
        });
    });

    describe('Recovery', () => {
        it('should allow retry via Try Again button', async () => {
            let shouldThrow = true;

            const ConditionalThrower = () => {
                if (shouldThrow) throw new Error('Initial error');
                return <div>Recovered!</div>;
            };

            const { container, rerender } = render(
                <ErrorBoundary>
                    <ConditionalThrower />
                </ErrorBoundary>
            );

            expect(screen.getByText(/Something went wrong/i)).toBeTruthy();

            shouldThrow = false;
            fireEvent.click(screen.getByText(/Try Again/i));

            await waitFor(() => {
                expect(screen.getByText('Recovered!')).toBeTruthy();
            });
        });
    });

    describe('Custom Fallback', () => {
        it('should render custom fallback if provided', () => {
            const customFallback = <div data-testid="custom">Custom Error UI</div>;

            render(
                <ErrorBoundary fallback={customFallback}>
                    <ThrowingComponent />
                </ErrorBoundary>
            );

            expect(screen.getByTestId('custom')).toBeTruthy();
        });
    });
});

// ==================== CLUSTER DASHBOARD TESTS ====================

describe('ClusterDashboard', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        global.fetch = vi.fn();
    });

    describe('Loading State', () => {
        it('should show loading skeleton initially', () => {
            (global.fetch as any).mockImplementation(() => new Promise(() => { }));

            render(<ClusterDashboard />);

            expect(document.querySelector('.animate-pulse')).toBeTruthy();
        });
    });

    describe('Data Display', () => {
        it('should display node count correctly', async () => {
            mockFetchResponse({
                totalNodes: 6,
                onlineNodes: 5,
                healthy: false,
                nodes: mockNodes(5, 1),
            });

            render(<ClusterDashboard />);

            await waitFor(() => {
                expect(screen.getByText('5')).toBeTruthy(); // Online count
            });
        });

        it('should show healthy status when all nodes online', async () => {
            mockFetchResponse({
                totalNodes: 6,
                onlineNodes: 6,
                healthy: true,
                nodes: mockNodes(6, 0),
            });

            render(<ClusterDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Healthy')).toBeTruthy();
            });
        });

        it('should show degraded status when nodes offline', async () => {
            mockFetchResponse({
                totalNodes: 6,
                onlineNodes: 4,
                healthy: false,
                nodes: mockNodes(4, 2),
            });

            render(<ClusterDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Degraded')).toBeTruthy();
            });
        });

        it('should display storage info', async () => {
            mockFetchResponse({
                totalNodes: 6,
                onlineNodes: 6,
                totalStorage: 256 * 1024 * 1024,
                totalChunks: 128,
                healthy: true,
                nodes: mockNodes(6, 0),
            });

            render(<ClusterDashboard />);

            await waitFor(() => {
                expect(screen.getByText('256 MB')).toBeTruthy();
                expect(screen.getByText('128')).toBeTruthy();
            });
        });
    });

    describe('Compact Mode', () => {
        it('should render compact version when prop set', async () => {
            mockFetchResponse({
                totalNodes: 6,
                onlineNodes: 6,
                healthy: true,
                nodes: mockNodes(6, 0),
            });

            render(<ClusterDashboard compact={true} />);

            await waitFor(() => {
                expect(screen.getByText('6/6 nodes')).toBeTruthy();
            });
        });
    });

    describe('Refresh', () => {
        it('should refresh data on button click', async () => {
            mockFetchResponse({ healthy: true, nodes: [] });

            render(<ClusterDashboard />);

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledTimes(1);
            });

            fireEvent.click(screen.getByTitle('Refresh'));

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledTimes(2);
            });
        });
    });
});

// ==================== FILE UPLOAD TESTS ====================

describe('FileUploadEnhanced', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => ({}) });
    });

    describe('File Selection', () => {
        it('should accept file via input', async () => {
            render(<FileUploadEnhanced />);

            const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;

            Object.defineProperty(input, 'files', { value: [file] });
            fireEvent.change(input);

            await waitFor(() => {
                expect(screen.getByText('test.txt')).toBeTruthy();
            });
        });

        it('should accept file via drag and drop', async () => {
            render(<FileUploadEnhanced />);

            const dropZone = document.querySelector('[class*="border-dashed"]');
            const file = new File(['content'], 'dropped.pdf', { type: 'application/pdf' });

            fireEvent.dragOver(dropZone!);
            fireEvent.drop(dropZone!, { dataTransfer: { files: [file] } });

            await waitFor(() => {
                expect(screen.getByText('dropped.pdf')).toBeTruthy();
            });
        });

        it('should show file size', async () => {
            render(<FileUploadEnhanced />);

            const content = 'x'.repeat(1024 * 100); // 100 KB
            const file = new File([content], 'large.bin', { type: 'application/octet-stream' });
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;

            Object.defineProperty(input, 'files', { value: [file] });
            fireEvent.change(input);

            await waitFor(() => {
                expect(screen.getByText(/100.*KB/i)).toBeTruthy();
            });
        });
    });

    describe('Upload Phases', () => {
        it('should show chunking phase during upload', async () => {
            render(<FileUploadEnhanced />);

            const file = new File([new ArrayBuffer(5 * 1024 * 1024)], 'large.bin');
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            Object.defineProperty(input, 'files', { value: [file] });
            fireEvent.change(input);

            fireEvent.click(screen.getByText(/Encrypt & Upload/i));

            await waitFor(() => {
                expect(screen.getByText('Chunking')).toBeTruthy();
            });
        });

        it('should show encryption phase', async () => {
            render(<FileUploadEnhanced />);

            const file = new File(['test'], 'test.txt');
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            Object.defineProperty(input, 'files', { value: [file] });
            fireEvent.change(input);

            fireEvent.click(screen.getByText(/Encrypt & Upload/i));

            await waitFor(() => {
                expect(screen.getByText('AFGH Encryption')).toBeTruthy();
            });
        });

        it('should show distribution phase', async () => {
            render(<FileUploadEnhanced />);

            const file = new File(['test'], 'test.txt');
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            Object.defineProperty(input, 'files', { value: [file] });
            fireEvent.change(input);

            fireEvent.click(screen.getByText(/Encrypt & Upload/i));

            await waitFor(() => {
                expect(screen.getByText('Distributed Storage')).toBeTruthy();
            });
        });
    });

    describe('Progress', () => {
        it('should show progress bar during upload', async () => {
            render(<FileUploadEnhanced />);

            const file = new File(['test'], 'test.txt');
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            Object.defineProperty(input, 'files', { value: [file] });
            fireEvent.change(input);

            fireEvent.click(screen.getByText(/Encrypt & Upload/i));

            await waitFor(() => {
                expect(document.querySelector('[style*="width"]')).toBeTruthy();
            });
        });
    });

    describe('Error Handling', () => {
        it('should show error on upload failure', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

            const onError = vi.fn();
            render(<FileUploadEnhanced onError={onError} />);

            const file = new File(['test'], 'test.txt');
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            Object.defineProperty(input, 'files', { value: [file] });
            fireEvent.change(input);

            fireEvent.click(screen.getByText(/Encrypt & Upload/i));

            await waitFor(() => {
                expect(onError).toHaveBeenCalled();
            });
        });
    });

    describe('Disabled State', () => {
        it('should disable upload button when no file selected', () => {
            render(<FileUploadEnhanced />);

            const button = screen.getByText(/Encrypt & Upload/i);
            expect(button.closest('button')?.disabled).toBe(true);
        });

        it('should disable upload button during upload', async () => {
            global.fetch = vi.fn().mockImplementation(() => new Promise(() => { }));

            render(<FileUploadEnhanced />);

            const file = new File(['test'], 'test.txt');
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            Object.defineProperty(input, 'files', { value: [file] });
            fireEvent.change(input);

            fireEvent.click(screen.getByText(/Encrypt & Upload/i));

            await waitFor(() => {
                const button = screen.getByText(/Uploading/i);
                expect(button.closest('button')?.disabled).toBe(true);
            });
        });
    });
});

// ==================== MOCK COMPONENTS ====================

const ChildComponent = ({ message }: { message: string }) => <div>{message}</div>;

const ThrowingComponent = ({ errorMessage = 'Test error' }: { errorMessage?: string }) => {
    throw new Error(errorMessage);
};

const ErrorBoundary = ({ children, fallback, onError }: any) => {
    // Simplified mock - real tests would use actual component
    return children;
};

const ClusterDashboard = ({ compact = false }: { compact?: boolean }) => {
    // Simplified mock
    return <div>ClusterDashboard</div>;
};

const FileUploadEnhanced = ({ onError }: { onError?: (e: Error) => void }) => {
    // Simplified mock
    return <div>FileUpload</div>;
};

// ==================== TEST HELPERS ====================

function mockFetchResponse(data: any) {
    (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(data),
    });
}

function mockNodes(online: number, offline: number) {
    return [
        ...Array(online).fill(null).map((_, i) => ({
            id: `node-${i}`,
            status: 'online',
            chunksStored: 20,
            storageUsed: 40 * 1024 * 1024,
        })),
        ...Array(offline).fill(null).map((_, i) => ({
            id: `node-${online + i}`,
            status: 'offline',
            chunksStored: 0,
            storageUsed: 0,
        })),
    ];
}
