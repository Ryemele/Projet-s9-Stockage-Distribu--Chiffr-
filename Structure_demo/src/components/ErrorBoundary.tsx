import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.setState({ errorInfo });

        // Log to console in development
        console.error('ErrorBoundary caught:', error, errorInfo);

        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);

        // In production, send to error tracking service
        if (import.meta.env.PROD) {
            this.reportError(error, errorInfo);
        }
    }

    private reportError(error: Error, errorInfo: ErrorInfo): void {
        // Send to error tracking service (e.g., Sentry)
        try {
            const errorData = {
                message: error.message,
                stack: error.stack,
                componentStack: errorInfo.componentStack,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href,
            };

            // Example: send to backend logging endpoint
            fetch('/api/errors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(errorData),
            }).catch(() => {
                // Silently fail if error reporting fails
            });
        } catch {
            // Silently fail
        }
    }

    private handleRetry = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    private handleGoHome = (): void => {
        window.location.href = '/';
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
                        <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-6">
                            <AlertTriangle className="h-8 w-8 text-red-600" />
                        </div>

                        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
                            Something went wrong
                        </h1>

                        <p className="text-gray-600 text-center mb-6">
                            We're sorry, but something unexpected happened. Please try again or return to the home page.
                        </p>

                        {import.meta.env.DEV && this.state.error && (
                            <div className="mb-6 p-4 bg-gray-100 rounded-lg overflow-auto max-h-48">
                                <p className="text-sm font-mono text-red-600 mb-2">
                                    {this.state.error.message}
                                </p>
                                <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap">
                                    {this.state.error.stack}
                                </pre>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={this.handleRetry}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                            >
                                <RefreshCw className="h-4 w-4" />
                                Try Again
                            </button>

                            <button
                                onClick={this.handleGoHome}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                                <Home className="h-4 w-4" />
                                Go Home
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Hook version for functional components
export function useErrorHandler() {
    const [error, setError] = React.useState<Error | null>(null);

    const handleError = React.useCallback((error: Error) => {
        console.error('Error caught by useErrorHandler:', error);
        setError(error);

        // Report to backend in production
        if (import.meta.env.PROD) {
            fetch('/api/errors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: error.message,
                    stack: error.stack,
                    timestamp: new Date().toISOString(),
                }),
            }).catch(() => { });
        }
    }, []);

    const resetError = React.useCallback(() => {
        setError(null);
    }, []);

    // Throw error to be caught by ErrorBoundary
    if (error) {
        throw error;
    }

    return { handleError, resetError };
}

// Async error handler wrapper
export function withAsyncErrorHandling<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    onError?: (error: Error) => void
): T {
    return (async (...args: Parameters<T>) => {
        try {
            return await fn(...args);
        } catch (error: any) {
            console.error('Async error:', error);
            onError?.(error);
            throw error;
        }
    }) as T;
}
