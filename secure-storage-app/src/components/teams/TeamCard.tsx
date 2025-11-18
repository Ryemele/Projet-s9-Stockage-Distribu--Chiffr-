import React from 'react';
import { Users, Settings, Trash2, Shield, Eye, Edit2 } from 'lucide-react';
import type { Team } from '../../types/teams';
import { getTeamFileCount } from '../../mocks';

interface TeamCardProps {
  team: Team;
  onManage: (team: Team) => void;
  onDelete: (teamId: string) => void;
  onEdit?: (team: Team) => void;
  isAdmin: boolean;
}

export const TeamCard: React.FC<TeamCardProps> = ({ team, onManage, onDelete, onEdit, isAdmin }) => {
  // Get exact file count for this team
  const exactFileCount = getTeamFileCount(team.id);

  const getRoleBadge = () => {
    const currentUser = team.members.find(m => m.id === 'current-user-id');
    const role = currentUser?.role || 'viewer';

    const badges = {
      admin: { icon: Shield, label: 'Admin', color: 'bg-purple-100 text-purple-700' },
      member: { icon: Users, label: 'Member', color: 'bg-blue-100 text-primary-700' },
      viewer: { icon: Eye, label: 'Viewer', color: 'bg-gray-100 text-gray-700' },
    };

    const badge = badges[role];
    const Icon = badge.icon;

    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="h-3 w-3" />
        {badge.label}
      </div>
    );
  };

  return (
    <div className="group relative bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg hover:border-primary-200 transition-all duration-200 cursor-pointer overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary-500 to-secondary-400 opacity-5 rounded-bl-full"></div>

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-secondary-400 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-200">
              <Users className="h-7 w-7 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                {team.name}
              </h3>
              <div className="mt-1">
                {getRoleBadge()}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onManage(team);
              }}
              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
              title="Manage team"
            >
              <Settings className="h-4 w-4" />
            </button>
            {isAdmin && onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(team);
                }}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                title="Edit team"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
            {isAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(team.id);
                }}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Delete team"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        {team.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-4">{team.description}</p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-6 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="h-4 w-4 text-gray-400" />
            <span>{team.members.length} {team.members.length === 1 ? 'member' : 'members'}</span>
          </div>
          <div className="text-sm text-gray-500">
            {exactFileCount} {exactFileCount === 1 ? 'file' : 'files'}
          </div>
        </div>
      </div>
    </div>
  );
};
