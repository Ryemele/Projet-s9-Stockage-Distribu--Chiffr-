import React, { useState } from "react";
import { Plus, Users, Shield, Search } from "lucide-react";
import type { Team } from "../types/teams";
import { TeamCard } from "../components/teams/TeamCard";
import { TeamManagementModal } from "../components/teams/TeamManagementModal";
import { CreateTeamModal } from "../components/teams/CreateTeamModal";
import { EditTeamModal } from "../components/teams/EditTeamModal";
import {
  getAllTeams,
  addTeam,
  deleteTeamById,
  updateTeam,
  getTeamFileCount,
} from "../mocks";
import { useToast } from "../contexts/ToastContext";

export const TeamsPage: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>(getAllTeams());
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { showSuccess, showError } = useToast();

  const handleCreateTeam = (team: Team) => {
    addTeam(team);
    setTeams(getAllTeams());
    showSuccess("Team created", `${team.name} has been created successfully`);
    setShowCreateModal(false);
  };

  const handleDeleteTeam = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    if (confirm("Are you sure you want to delete this team?")) {
      deleteTeamById(teamId);
      setTeams(getAllTeams());
      showSuccess("Team deleted", `${team?.name || "Team"} has been deleted`);
    }
  };

  const handleUpdateTeam = (updatedTeam: Team) => {
    const result = updateTeam(updatedTeam.id, updatedTeam);
    if (result) {
      setTeams(getAllTeams());
      showSuccess(
        "Team updated",
        `${updatedTeam.name} has been updated successfully`
      );
      setEditTeam(null);
    } else {
      showError("Update failed", "Failed to update team");
    }
  };

  const handleEditClick = (team: Team) => {
    setEditTeam(team);
  };

  // Filter teams based on search query
  const filteredTeams = teams.filter(
    (team) =>
      team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const userTeams = filteredTeams;
  const adminTeams = filteredTeams.filter(
    (t) => t.members.find((m) => m.id === "current-user-id")?.role === "admin"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
          <p className="text-gray-600 mt-1">
            Collaborate and share files with your teams
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-all shadow-sm hover:shadow-md"
        >
          <Plus className="h-5 w-5" />
          Create Team
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Teams Overview Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Teams Overview
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary-600" />
                </div>
                <span className="text-sm text-gray-600">Total Teams</span>
              </div>
              <span className="text-xl font-bold text-gray-900">
                {userTeams.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                <span className="text-sm text-gray-600">Managed</span>
              </div>
              <span className="text-xl font-bold text-gray-900">
                {adminTeams.length}
              </span>
            </div>
          </div>
        </div>

        {/* Total Members Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Total Members
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {(() => {
                  const uniqueMembers = new Map();
                  teams.forEach((team) => {
                    team.members.forEach((member) => {
                      uniqueMembers.set(member.email, member);
                    });
                  });
                  return uniqueMembers.size;
                })()}
              </p>
            </div>
          </div>
          <div className="space-y-3 mt-4">
            {(() => {
              const uniqueMembers = new Map();
              teams.forEach((team) => {
                team.members.forEach((member) => {
                  uniqueMembers.set(member.email, member);
                });
              });
              return Array.from(uniqueMembers.values())
                .slice(0, 3)
                .map((member, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-400 flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0">
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-white text-sm font-semibold">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {member.email}
                      </p>
                    </div>
                  </div>
                ));
            })()}
            {(() => {
              const uniqueMembers = new Map();
              teams.forEach((team) => {
                team.members.forEach((member) => {
                  uniqueMembers.set(member.email, member);
                });
              });
              return (
                uniqueMembers.size > 3 && (
                  <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-100">
                    +{uniqueMembers.size - 3} more members
                  </div>
                )
              );
            })()}
          </div>
        </div>

        {/* Active Teams Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Most Active Teams
          </h3>
          <div className="space-y-3">
            {teams
              .map((team) => ({
                ...team,
                actualFileCount: getTeamFileCount(team.id),
              }))
              .sort((a, b) => b.actualFileCount - a.actualFileCount)
              .slice(0, 3)
              .map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-400 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Users className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {team.name}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-gray-500 ml-2">
                    {team.actualFileCount} files
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Teams Grid */}
      {userTeams.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
            <Users className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No teams yet
          </h3>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            Create your first team to start collaborating and sharing files with
            others
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-all"
          >
            <Plus className="h-5 w-5" />
            Create Your First Team
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {userTeams.map((team) => {
            const isAdmin =
              team.members.find((m) => m.id === "current-user-id")?.role ===
              "admin";
            return (
              <div key={team.id} onClick={() => setSelectedTeam(team)}>
                <TeamCard
                  team={team}
                  isAdmin={isAdmin}
                  onManage={setSelectedTeam}
                  onDelete={handleDeleteTeam}
                  onEdit={handleEditClick}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateTeam}
        />
      )}

      {/* Team Management Modal */}
      {selectedTeam && (
        <TeamManagementModal
          team={selectedTeam}
          isAdmin={
            selectedTeam.members.find((m) => m.id === "current-user-id")
              ?.role === "admin" || false
          }
          onClose={() => setSelectedTeam(null)}
          onUpdate={handleUpdateTeam}
        />
      )}

      {/* Edit Team Modal */}
      {editTeam && (
        <EditTeamModal
          team={editTeam}
          onClose={() => setEditTeam(null)}
          onSave={handleUpdateTeam}
        />
      )}
    </div>
  );
};
