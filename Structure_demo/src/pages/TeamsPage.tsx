import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  MoreVertical,
  Edit3,
  Trash2,
  UserPlus,
  Crown,
  Mail,
  X,
  Search,
  Grid,
  List
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface Team {
  id: string;
  name: string;
  description: string;
  avatar_color: string;
  owner_id: string;
  member_count: number;
  user_role: 'owner' | 'member';
  created_at: string;
}

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  joined_at: string;
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9',
];

export const TeamsPage: React.FC = () => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [newTeamColor, setNewTeamColor] = useState(COLORS[0]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/teams', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeamDetails = async (team: Team) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/teams/${team.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
        setSelectedTeam(team);
      }
    } catch (error) {
      console.error('Error fetching team details:', error);
    }
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newTeamName,
          description: newTeamDesc,
          color: newTeamColor
        })
      });
      if (response.ok) {
        const data = await response.json();
        setTeams([data.team, ...teams]);
        setShowCreateModal(false);
        setNewTeamName('');
        setNewTeamDesc('');
        setNewTeamColor(COLORS[0]);
      }
    } catch (error) {
      console.error('Error creating team:', error);
    }
  };

  const addMember = async () => {
    if (!selectedTeam || !newMemberEmail.trim()) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/teams/${selectedTeam.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: newMemberEmail })
      });
      if (response.ok) {
        setShowAddMemberModal(false);
        setNewMemberEmail('');
        fetchTeamDetails(selectedTeam);
      }
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!selectedTeam) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/teams/${selectedTeam.id}/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setMembers(members.filter(m => m.id !== memberId));
      }
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/teams/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setTeams(teams.filter(t => t.id !== id));
        if (selectedTeam?.id === id) {
          setSelectedTeam(null);
          setMembers([]);
        }
        setActiveMenu(null);
      }
    } catch (error) {
      console.error('Error deleting team:', error);
    }
  };

  const filteredTeams = teams.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Teams List */}
      <div className={`${selectedTeam ? 'w-1/2' : 'w-full'} space-y-6 transition-all`}>
        {/* Header with gradient */}
        <div className="relative overflow-hidden bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-600 rounded-2xl p-8 text-white">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-cyan-300/20 rounded-full blur-3xl"></div>

          <div className="relative">
            <h1 className="text-3xl font-bold mb-2">Teams</h1>
            <p className="text-white/80">Collaborate with your team members</p>

            <div className="flex items-center gap-4 mt-6">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60" />
                <input
                  type="text"
                  placeholder="Search teams..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
                />
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white text-cyan-600 font-semibold rounded-xl hover:bg-white/90 transition-all shadow-lg hover:shadow-xl"
              >
                <Plus className="h-5 w-5" />
                New Team
              </button>
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Users className="h-4 w-4" />
            <span>{teams.length} team{teams.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow text-cyan-600' : 'text-gray-500'}`}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-cyan-600' : 'text-gray-500'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Teams Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-2xl mb-4">
              <Users className="h-10 w-10 text-cyan-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery ? 'No teams found' : 'Create your first team'}
            </h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Start collaborating by creating a team and inviting members.
            </p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'space-y-3'}>
            {filteredTeams.map((team) => (
              <div
                key={team.id}
                onClick={() => fetchTeamDetails(team)}
                className={`group relative bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-lg hover:border-gray-300 transition-all cursor-pointer
                  ${selectedTeam?.id === team.id ? 'ring-2 ring-cyan-500 border-cyan-500' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: team.avatar_color }}
                  >
                    {getInitials(team.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">{team.name}</h3>
                      {team.user_role === 'owner' && (
                        <Crown className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{team.description || 'No description'}</p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                      <Users className="h-4 w-4" />
                      <span>{team.member_count} member{team.member_count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  {team.user_role === 'owner' && (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === team.id ? null : team.id);
                        }}
                        className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all"
                      >
                        <MoreVertical className="h-5 w-5 text-gray-500" />
                      </button>

                      {activeMenu === team.id && (
                        <div className="absolute right-0 top-8 w-40 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10">
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteTeam(team.id); }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" /> Delete Team
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Details Panel */}
      {selectedTeam && (
        <div className="w-1/2 bg-white rounded-2xl border border-gray-200 p-6 h-fit sticky top-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                style={{ backgroundColor: selectedTeam.avatar_color }}
              >
                {getInitials(selectedTeam.name)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedTeam.name}</h2>
                <p className="text-gray-500">{selectedTeam.description || 'No description'}</p>
              </div>
            </div>
            <button
              onClick={() => { setSelectedTeam(null); setMembers([]); }}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Members ({members.length})</h3>
            {selectedTeam.user_role === 'owner' && (
              <button
                onClick={() => setShowAddMemberModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-50 text-cyan-600 font-medium rounded-lg hover:bg-cyan-100 transition-all"
              >
                <UserPlus className="h-4 w-4" />
                Add Member
              </button>
            )}
          </div>

          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-medium">
                    {member.name?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{member.name || member.email}</span>
                      {member.role === 'owner' && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                          Owner
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">{member.email}</span>
                  </div>
                </div>
                {selectedTeam.user_role === 'owner' && member.role !== 'owner' && (
                  <button
                    onClick={() => removeMember(member.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Team</h2>

            <input
              type="text"
              placeholder="Team name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-4"
              autoFocus
            />

            <textarea
              placeholder="Description (optional)"
              value={newTeamDesc}
              onChange={(e) => setNewTeamDesc(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-4 resize-none h-24"
            />

            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Team Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewTeamColor(color)}
                    className={`w-8 h-8 rounded-full transition-all ${newTeamColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowCreateModal(false); setNewTeamName(''); setNewTeamDesc(''); }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createTeam}
                disabled={!newTeamName.trim()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium rounded-xl hover:shadow-lg disabled:opacity-50"
              >
                Create Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Team Member</h2>

            <div className="relative mb-6">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="email"
                placeholder="Enter member's email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowAddMemberModal(false); setNewMemberEmail(''); }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addMember}
                disabled={!newMemberEmail.trim()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium rounded-xl hover:shadow-lg disabled:opacity-50"
              >
                Add Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside handler */}
      {activeMenu && (
        <div className="fixed inset-0 z-5" onClick={() => setActiveMenu(null)} />
      )}
    </div>
  );
};
