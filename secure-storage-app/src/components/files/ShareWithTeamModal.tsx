import React, { useState } from 'react';
import { X, Users, Check, Shield, Share2, Lock } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  members: number;
  role: string;
}

interface ShareWithTeamModalProps {
  fileName: string;
  onClose: () => void;
  onShare: (teamIds: string[]) => void;
}

export const ShareWithTeamModal: React.FC<ShareWithTeamModalProps> = ({ fileName, onClose, onShare }) => {
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  // Mock teams data - in real app, this would come from your state/API
  const teams: Team[] = [
    { id: '1', name: 'Engineering Team', members: 3, role: 'admin' },
    { id: '2', name: 'Marketing Team', members: 2, role: 'admin' },
    { id: '3', name: 'Design Team', members: 5, role: 'member' },
  ];

  const toggleTeam = (teamId: string) => {
    setSelectedTeams(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const handleShare = () => {
    if (selectedTeams.length > 0) {
      onShare(selectedTeams);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-primary-600 to-secondary-400 px-6 py-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Share2 className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Share with Teams</h2>
              <p className="text-blue-100 mt-1 text-sm">
                {fileName}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Select teams to share with
            </h3>
            <p className="text-xs text-gray-600 mb-4">
              Only team members will be able to access this encrypted file
            </p>
          </div>

          {/* Teams List */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {teams.map((team) => {
              const isSelected = selectedTeams.includes(team.id);

              return (
                <button
                  key={team.id}
                  onClick={() => toggleTeam(team.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isSelected
                        ? 'bg-primary-600'
                        : 'bg-gradient-to-br from-purple-500 to-secondary-400'
                    }`}>
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{team.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-600">
                          {team.members} members
                        </span>
                        {team.role === 'admin' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                            <Shield className="h-3 w-3" />
                            Admin
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-primary-600'
                      : 'border-gray-300 bg-white'
                  }`}>
                    {isSelected && <Check className="h-4 w-4 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Info Banner */}
          <div className="mt-4 bg-primary-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Lock className="h-4 w-4 text-primary-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-gray-700">
                <p className="font-medium text-gray-900 mb-1">Secure Sharing</p>
                <p className="text-gray-600">
                  The file will remain encrypted and only team members with proper permissions can decrypt and access it.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {selectedTeams.length > 0 ? (
              <span className="font-medium text-primary-600">
                {selectedTeams.length} team{selectedTeams.length !== 1 ? 's' : ''} selected
              </span>
            ) : (
              <span>No teams selected</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleShare}
              disabled={selectedTeams.length === 0}
              className="px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-400 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Share with Teams
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
