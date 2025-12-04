import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BreadcrumbItem {
  id: string;
  name: string;
  path: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  const navigate = useNavigate();

  return (
    <nav className="flex items-center space-x-2 text-sm">
      <button
        onClick={() => navigate('/folders')}
        className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
      >
        <Home className="h-4 w-4" />
        <span className="font-medium">Folders</span>
      </button>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={item.id}>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            {isLast ? (
              <span className="px-3 py-1.5 text-primary-600 bg-primary-50 rounded-lg font-medium">
                {item.name}
              </span>
            ) : (
              <button
                onClick={() => navigate(item.path)}
                className="px-3 py-1.5 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all font-medium"
              >
                {item.name}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
