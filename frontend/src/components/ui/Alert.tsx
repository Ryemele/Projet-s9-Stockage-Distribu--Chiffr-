import React from 'react';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

interface AlertProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  message,
  onClose,
}) => {
  const styles = {
    success: {
      container: 'bg-green-50 border-green-200 text-green-800',
      icon: <CheckCircle className="h-5 w-5 text-green-600" />,
    },
    error: {
      container: 'bg-red-50 border-red-200 text-red-800',
      icon: <XCircle className="h-5 w-5 text-red-600" />,
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      icon: <AlertCircle className="h-5 w-5 text-yellow-600" />,
    },
    info: {
      container: 'bg-primary-50 border-blue-200 text-blue-800',
      icon: <Info className="h-5 w-5 text-primary-600" />,
    },
  };

  const currentStyle = styles[type];

  return (
    <div
      className={`border rounded-lg p-4 ${currentStyle.container}`}
      role="alert"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">{currentStyle.icon}</div>
        <div className="ml-3 flex-1">
          {title && <h3 className="text-sm font-medium">{title}</h3>}
          <div className={`text-sm ${title ? 'mt-1' : ''}`}>{message}</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-3 inline-flex flex-shrink-0 rounded-md p-1.5 hover:bg-opacity-20 focus:outline-none"
          >
            <span className="sr-only">Close</span>
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};
