import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import type { Team } from '../../types/teams';
import { Button, Input } from '../ui';

interface EditTeamModalProps {
  team: Team;
  onClose: () => void;
  onSave: (updatedTeam: Team) => void;
}

export const EditTeamModal: React.FC<EditTeamModalProps> = ({ team, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: team.name,
    description: team.description,
    allowMemberInvites: team.settings.allowMemberInvites,
    allowFileSharing: team.settings.allowFileSharing,
    requireApproval: team.settings.requireApproval,
    maxMembers: team.settings.maxMembers,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Team name is required';
    }

    if (formData.maxMembers < 1) {
      newErrors.maxMembers = 'Max members must be at least 1';
    }

    if (formData.maxMembers > 1000) {
      newErrors.maxMembers = 'Max members cannot exceed 1000';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const updatedTeam: Team = {
      ...team,
      name: formData.name,
      description: formData.description,
      settings: {
        allowMemberInvites: formData.allowMemberInvites,
        allowFileSharing: formData.allowFileSharing,
        requireApproval: formData.requireApproval,
        maxMembers: formData.maxMembers,
      },
    };

    onSave(updatedTeam);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-primary-600 via-primary-500 to-secondary-400 px-8 py-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 className="text-2xl font-bold text-white">Edit Team</h2>
          <p className="text-white/90 text-sm mt-1">Update team information and settings</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8">
          <div className="space-y-6">
            {/* Team Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Team Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter team name"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter team description"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Max Members */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Members
              </label>
              <Input
                type="number"
                min="1"
                max="1000"
                value={formData.maxMembers}
                onChange={(e) => setFormData({ ...formData, maxMembers: parseInt(e.target.value) || 1 })}
                className={errors.maxMembers ? 'border-red-500' : ''}
              />
              {errors.maxMembers && <p className="text-red-500 text-sm mt-1">{errors.maxMembers}</p>}
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Team Settings</h3>

              {/* Allow Member Invites */}
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <div>
                  <p className="font-medium text-gray-900">Allow Member Invites</p>
                  <p className="text-sm text-gray-600">Members can invite others to join the team</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.allowMemberInvites}
                  onChange={(e) => setFormData({ ...formData, allowMemberInvites: e.target.checked })}
                  className="w-5 h-5 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 focus:ring-2"
                />
              </label>

              {/* Allow File Sharing */}
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <div>
                  <p className="font-medium text-gray-900">Allow File Sharing</p>
                  <p className="text-sm text-gray-600">Members can share files with the team</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.allowFileSharing}
                  onChange={(e) => setFormData({ ...formData, allowFileSharing: e.target.checked })}
                  className="w-5 h-5 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 focus:ring-2"
                />
              </label>

              {/* Require Approval */}
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <div>
                  <p className="font-medium text-gray-900">Require Approval</p>
                  <p className="text-sm text-gray-600">New members must be approved by an admin</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.requireApproval}
                  onChange={(e) => setFormData({ ...formData, requireApproval: e.target.checked })}
                  className="w-5 h-5 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 focus:ring-2"
                />
              </label>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="border-t border-gray-200 px-8 py-4 bg-gray-50 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};
