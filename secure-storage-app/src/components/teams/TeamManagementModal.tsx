import React, { useState } from "react";
import {
  X,
  Shield,
  Users as UsersIcon,
  Eye,
  Settings as SettingsIcon,
  Trash2,
  File,
} from "lucide-react";
import type { Team, UserRole } from "../../types/teams";
import { ROLE_PERMISSIONS } from "../../types/teams";
import { TeamFilesTab } from "./TeamFilesTab";
import { getTeamFileCount } from "../../mocks";

interface TeamManagementModalProps {
  team: Team;
  isAdmin: boolean;
  onClose: () => void;
  onUpdate: (team: Team) => void;
}

export const TeamManagementModal: React.FC<TeamManagementModalProps> = ({
  team,
  isAdmin,
  onClose,
  onUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<"members" | "files" | "settings">(
    "members"
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("member");

  // Get exact file count for this team
  const exactFileCount = getTeamFileCount(team.id);

  const currentUserMember = team.members.find(
    (m) => m.id === "current-user-id"
  );
  const canUpload = currentUserMember
    ? ROLE_PERMISSIONS[currentUserMember.role].canUploadFiles
    : false;

  const handleInviteMember = () => {
    if (!inviteEmail.trim()) return;

    // TODO: Implement invite logic
    alert(`Invite sent to ${inviteEmail} as ${inviteRole}`);
    setInviteEmail("");
  };

  const handleChangeRole = (memberId: string, newRole: UserRole) => {
    const updatedMembers = team.members.map((m) =>
      m.id === memberId ? { ...m, role: newRole } : m
    );
    onUpdate({ ...team, members: updatedMembers });
  };

  const handleRemoveMember = (memberId: string) => {
    if (confirm("Remove this member from the team?")) {
      const updatedMembers = team.members.filter((m) => m.id !== memberId);
      onUpdate({ ...team, members: updatedMembers });
    }
  };

  const getRoleIcon = (role: UserRole) => {
    const icons = {
      admin: Shield,
      member: UsersIcon,
      viewer: Eye,
    };
    return icons[role];
  };

  const getRoleBadge = (role: UserRole) => {
    const badges = {
      admin: "bg-primary-100 text-primary-700",
      member: "bg-secondary-100 text-secondary-700",
      viewer: "bg-gray-100 text-gray-700",
    };
    return badges[role];
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-r from-primary-600 via-primary-500 to-secondary-400 px-8 py-8">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg">
              <UsersIcon className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-white mb-2">
                {team.name}
              </h2>
              <div className="flex items-center gap-4">
                {/* Members Avatars */}
                <div className="flex -space-x-2">
                  {team.members.slice(0, 5).map((member, index) => (
                    <div
                      key={member.id}
                      className="relative w-8 h-8 rounded-full border-2 border-white bg-gradient-to-br from-primary-400 to-secondary-500 flex items-center justify-center text-white text-xs font-semibold shadow-md overflow-hidden"
                      title={member.name}
                      style={{ zIndex: team.members.length - index }}
                    >
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{member.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                  ))}
                  {team.members.length > 5 && (
                    <div
                      className="relative w-8 h-8 rounded-full border-2 border-white bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-xs font-semibold shadow-md"
                      style={{ zIndex: 0 }}
                    >
                      +{team.members.length - 5}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 text-white/90">
                  <span className="text-sm font-medium">
                    {team.members.length} members
                  </span>
                  <span className="text-white/60">•</span>
                  <span className="text-sm font-medium">
                    {exactFileCount} files shared
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-gray-50 border-b border-gray-200 px-8 pt-6">
          <nav className="flex space-x-1">
            <button
              onClick={() => setActiveTab("members")}
              className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-medium text-sm transition-all duration-200 ${
                activeTab === "members"
                  ? "bg-white text-primary-600 shadow-sm -mb-px"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
              }`}
            >
              <UsersIcon className="h-4 w-4" />
              Members
              <span
                className={`ml-1 px-2 py-0.5 text-xs font-semibold rounded-full ${
                  activeTab === "members"
                    ? "bg-primary-100 text-primary-700"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {team.members.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("files")}
              className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-medium text-sm transition-all duration-200 ${
                activeTab === "files"
                  ? "bg-white text-primary-600 shadow-sm -mb-px"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
              }`}
            >
              <File className="h-4 w-4" />
              Files
              <span
                className={`ml-1 px-2 py-0.5 text-xs font-semibold rounded-full ${
                  activeTab === "files"
                    ? "bg-primary-100 text-primary-700"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {exactFileCount}
              </span>
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab("settings")}
                className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-medium text-sm transition-all duration-200 ${
                  activeTab === "settings"
                    ? "bg-white text-primary-600 shadow-sm -mb-px"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                }`}
              >
                <SettingsIcon className="h-4 w-4" />
                Settings
              </button>
            )}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
          {activeTab === "members" && (
            <div className="space-y-6">
              {/* Invite Member */}
              {isAdmin && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex gap-3">
                    <input
                      type="email"
                      placeholder="Email address"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-blue-500"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) =>
                        setInviteRole(e.target.value as UserRole)
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-blue-500"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={handleInviteMember}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium whitespace-nowrap"
                    >
                      Invite
                    </button>
                  </div>
                </div>
              )}

              {/* Members List */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider px-1">
                  Members ({team.members.length})
                </h3>
                <div className="space-y-2">
                  {team.members.map((member) => {
                    const RoleIcon = getRoleIcon(member.role);
                    return (
                      <div
                        key={member.id}
                        className="group flex items-center justify-between gap-3 p-3 hover:bg-white rounded-lg transition-all"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-400 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {member.avatar ? (
                              <img
                                src={member.avatar}
                                alt={member.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-white font-medium text-sm">
                                {member.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {member.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-gray-500 truncate">
                                {member.email}
                              </p>
                              <span className="text-gray-300">•</span>
                              {isAdmin ? (
                                <select
                                  value={member.role}
                                  onChange={(e) =>
                                    handleChangeRole(
                                      member.id,
                                      e.target.value as UserRole
                                    )
                                  }
                                  className={`px-2 py-0.5 rounded text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-primary-500 ${getRoleBadge(
                                    member.role
                                  )}`}
                                >
                                  <option value="viewer">Viewer</option>
                                  <option value="member">Member</option>
                                  <option value="admin">Admin</option>
                                </select>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-medium inline-flex items-center gap-1 ${getRoleBadge(
                                    member.role
                                  )}`}
                                >
                                  <RoleIcon className="h-3 w-3" />
                                  {member.role.charAt(0).toUpperCase() +
                                    member.role.slice(1)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isAdmin && member.role !== "admin" && (
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Remove member"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Role Permissions Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider px-1">
                  Permissions
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => {
                    const RoleIcon = getRoleIcon(role as UserRole);
                    const permissions = Object.entries(perms)
                      .filter(([, value]) => value)
                      .map(([key]) =>
                        key
                          .replace("can", "")
                          .replace(/([A-Z])/g, " $1")
                          .trim()
                          .toLowerCase()
                      );

                    return (
                      <div
                        key={role}
                        className="bg-white rounded-lg p-4 border border-gray-200"
                      >
                        <div
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium mb-3 ${getRoleBadge(
                            role as UserRole
                          )}`}
                        >
                          <RoleIcon className="h-3 w-3" />
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </div>
                        <ul className="space-y-1.5">
                          {permissions.map((perm, idx) => (
                            <li
                              key={idx}
                              className="text-xs text-gray-600 flex items-center gap-1.5"
                            >
                              <div className="w-1 h-1 bg-gray-400 rounded-full" />
                              {perm}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "files" && (
            <TeamFilesTab team={team} isAdmin={isAdmin} canUpload={canUpload} />
          )}

          {activeTab === "settings" && isAdmin && (
            <div className="space-y-6">
              {/* Team Settings */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Team Settings
                </label>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        Member invites
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Allow members to invite new people
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdate({
                          ...team,
                          settings: {
                            ...team.settings,
                            allowMemberInvites:
                              !team.settings.allowMemberInvites,
                          },
                        })
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                        team.settings.allowMemberInvites
                          ? "bg-primary-600"
                          : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          team.settings.allowMemberInvites
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        File sharing
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Allow members to share files with the team
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdate({
                          ...team,
                          settings: {
                            ...team.settings,
                            allowFileSharing: !team.settings.allowFileSharing,
                          },
                        })
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                        team.settings.allowFileSharing
                          ? "bg-primary-600"
                          : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          team.settings.allowFileSharing
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        Require approval
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Admin must approve new member requests
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdate({
                          ...team,
                          settings: {
                            ...team.settings,
                            requireApproval: !team.settings.requireApproval,
                          },
                        })
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                        team.settings.requireApproval
                          ? "bg-primary-600"
                          : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          team.settings.requireApproval
                            ? "translate-x-6"
                            : "translate-x-1"
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
        <div className="flex items-center justify-end gap-3 px-8 py-5 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all font-semibold shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
