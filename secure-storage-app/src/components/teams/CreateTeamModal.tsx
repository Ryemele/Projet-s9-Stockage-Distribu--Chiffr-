import React, { useState } from 'react';
import { X, Users, FileText, Shield, Check } from 'lucide-react';
import type { Team, TeamSettings } from '../../types/teams';

interface CreateTeamModalProps {
  onClose: () => void;
  onCreate: (team: Team) => void;
}

export const CreateTeamModal: React.FC<CreateTeamModalProps> = ({ onClose, onCreate }) => {
  const [step, setStep] = useState(1);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [settings, setSettings] = useState<TeamSettings>({
    allowMemberInvites: true,
    allowFileSharing: true,
    requireApproval: false,
    maxMembers: 50,
  });

  const handleCreate = () => {
    if (!teamName.trim()) return;

    const newTeam: Team = {
      id: Date.now().toString(),
      name: teamName.trim(),
      description: teamDescription.trim(),
      createdBy: 'current-user-id',
      createdAt: new Date().toISOString(),
      sharedFiles: 0,
      members: [
        {
          id: 'current-user-id',
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'admin',
          joinedAt: new Date().toISOString(),
        },
      ],
      settings,
    };

    onCreate(newTeam);
    onClose();
  };

  const nextStep = () => {
    if (step === 1 && teamName.trim()) {
      setStep(2);
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-primary-600 to-secondary-400 px-6 py-8">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Create New Team</h2>
              <p className="text-blue-100 mt-1">
                Set up your team in {step === 1 ? '2' : '1'} simple steps
              </p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-4 mt-6">
            <div className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                step >= 1 ? 'bg-white text-primary-600' : 'bg-white/20 text-white/60'
              }`}>
                {step > 1 ? <Check className="h-4 w-4" /> : '1'}
              </div>
              <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className={`h-full bg-white transition-all duration-300 ${step >= 1 ? 'w-full' : 'w-0'}`} />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                step >= 2 ? 'bg-white text-primary-600' : 'bg-white/20 text-white/60'
              }`}>
                2
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Team Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g., Engineering Team, Marketing Squad"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={teamDescription}
                  onChange={(e) => setTeamDescription(e.target.value)}
                  placeholder="What's this team about?"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="bg-primary-50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-gray-700">
                    <p className="font-medium text-gray-900 mb-1">Team Benefits</p>
                    <ul className="space-y-1 text-gray-600">
                      <li>• Share files securely with team members</li>
                      <li>• Manage access with role-based permissions</li>
                      <li>• Collaborate on encrypted documents</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Team Settings
                </label>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Member invites</p>
                      <p className="text-xs text-gray-500 mt-0.5">Allow members to invite new people</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, allowMemberInvites: !settings.allowMemberInvites })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                        settings.allowMemberInvites ? 'bg-primary-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.allowMemberInvites ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">File sharing</p>
                      <p className="text-xs text-gray-500 mt-0.5">Allow members to share files with the team</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, allowFileSharing: !settings.allowFileSharing })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                        settings.allowFileSharing ? 'bg-primary-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.allowFileSharing ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Require approval</p>
                      <p className="text-xs text-gray-500 mt-0.5">Admin must approve new member requests</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, requireApproval: !settings.requireApproval })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                        settings.requireApproval ? 'bg-primary-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.requireApproval ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button
            onClick={step === 1 ? onClose : prevStep}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors font-medium"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step === 1 ? (
            <button
              onClick={nextStep}
              disabled={!teamName.trim()}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Next: Settings
            </button>
          ) : (
            <button
              onClick={handleCreate}
              className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-secondary-400 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all font-medium shadow-lg hover:shadow-xl"
            >
              Create Team
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
