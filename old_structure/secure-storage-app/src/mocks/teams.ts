import type { Team, TeamMember } from "../types/teams";

export const mockTeams: Team[] = [
  {
    id: "team-1",
    name: "Engineering Team",
    description: "Core development team for product engineering",
    createdBy: "current-user-id",
    createdAt: new Date("2024-01-10").toISOString(),
    sharedFiles: 24,
    members: [
      {
        id: "current-user-id",
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        joinedAt: new Date("2024-01-10").toISOString(),
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin",
      },
    ],
    settings: {
      allowMemberInvites: true,
      allowFileSharing: true,
      requireApproval: false,
      maxMembers: 50,
    },
    memberCount: 0,
  },
  {
    id: "team-2",
    name: "Design Team",
    description: "UI/UX and graphic design team",
    createdBy: "user-2",
    createdAt: new Date("2024-01-15").toISOString(),
    sharedFiles: 18,
    members: [
      {
        id: "user-2",
        email: "george@example.com",
        name: "George Harris",
        role: "admin",
        joinedAt: new Date("2024-01-15").toISOString(),
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=George",
      },
      {
        id: "current-user-id",
        email: "admin@example.com",
        name: "Admin User",
        role: "member",
        joinedAt: new Date("2024-01-18").toISOString(),
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin",
      },
    ],
    settings: {
      allowMemberInvites: true,
      allowFileSharing: true,
      requireApproval: false,
      maxMembers: 30,
    },
    memberCount: 0,
  },
  {
    id: "team-3",
    name: "Marketing",
    description: "Marketing and communications team",
    createdBy: "user-3",
    createdAt: new Date("2024-02-01").toISOString(),
    sharedFiles: 15,
    members: [
      {
        id: "user-3",
        email: "laura@example.com",
        name: "Laura Quinn",
        role: "admin",
        joinedAt: new Date("2024-02-01").toISOString(),
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Laura",
      },
      {
        id: "current-user-id",
        email: "admin@example.com",
        name: "Admin User",
        role: "viewer",
        joinedAt: new Date("2024-02-05").toISOString(),
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin",
      },
    ],
    settings: {
      allowMemberInvites: false,
      allowFileSharing: true,
      requireApproval: true,
      maxMembers: 25,
    },
    memberCount: 0,
  },
  {
    id: "team-4",
    name: "Sales",
    description: "Sales and business development",
    createdBy: "current-user-id",
    createdAt: new Date("2024-02-10").toISOString(),
    sharedFiles: 12,
    members: [
      {
        id: "current-user-id",
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        joinedAt: new Date("2024-02-10").toISOString(),
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin",
      },
    ],
    settings: {
      allowMemberInvites: true,
      allowFileSharing: true,
      requireApproval: false,
      maxMembers: 20,
    },
    memberCount: 0,
  },
];

export const mockTeamMembers: Record<string, TeamMember[]> = {
  "team-1": [
    {
      id: "member-1-0",
      name: "Admin User",
      email: "admin@example.com",
      role: "admin",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin",
      joinedAt: new Date("2024-01-10").toISOString(),
    },
    {
      id: "member-1-1",
      name: "John Doe",
      email: "john@example.com",
      role: "admin",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
      joinedAt: new Date("2024-01-10").toISOString(),
    },
    {
      id: "member-1-2",
      name: "Jane Smith",
      email: "jane@example.com",
      role: "member",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jane",
      joinedAt: new Date("2024-01-12").toISOString(),
    },
    {
      id: "member-1-3",
      name: "Bob Wilson",
      email: "bob@example.com",
      role: "member",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
      joinedAt: new Date("2024-01-15").toISOString(),
    },
    {
      id: "member-1-4",
      name: "Alice Brown",
      email: "alice@example.com",
      role: "viewer",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
      joinedAt: new Date("2024-01-20").toISOString(),
    },
    {
      id: "member-1-5",
      name: "Charlie Davis",
      email: "charlie@example.com",
      role: "member",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie",
      joinedAt: new Date("2024-02-01").toISOString(),
    },
    {
      id: "member-1-6",
      name: "Diana Evans",
      email: "diana@example.com",
      role: "member",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Diana",
      joinedAt: new Date("2024-02-05").toISOString(),
    },
    {
      id: "member-1-7",
      name: "Ethan Foster",
      email: "ethan@example.com",
      role: "viewer",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ethan",
      joinedAt: new Date("2024-02-10").toISOString(),
    },
    {
      id: "member-1-8",
      name: "Fiona Green",
      email: "fiona@example.com",
      role: "member",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Fiona",
      joinedAt: new Date("2024-02-15").toISOString(),
    },
  ],
  "team-2": [
    {
      id: "member-2-1",
      name: "George Harris",
      email: "george@example.com",
      role: "admin",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=George",
      joinedAt: new Date("2024-01-15").toISOString(),
    },
    {
      id: "member-2-2",
      name: "Hannah Lee",
      email: "hannah@example.com",
      role: "member",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Hannah",
      joinedAt: new Date("2024-01-18").toISOString(),
    },
    {
      id: "member-2-3",
      name: "Ian Moore",
      email: "ian@example.com",
      role: "member",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ian",
      joinedAt: new Date("2024-01-20").toISOString(),
    },
    {
      id: "member-2-4",
      name: "Julia Nelson",
      email: "julia@example.com",
      role: "member",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Julia",
      joinedAt: new Date("2024-01-25").toISOString(),
    },
    {
      id: "member-2-5",
      name: "Kevin Park",
      email: "kevin@example.com",
      role: "viewer",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kevin",
      joinedAt: new Date("2024-02-01").toISOString(),
    },
  ],
  "team-3": [
    {
      id: "member-3-1",
      name: "Laura Quinn",
      email: "laura@example.com",
      role: "admin",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Laura",
      joinedAt: new Date("2024-02-01").toISOString(),
    },
    {
      id: "member-3-2",
      name: "Mike Roberts",
      email: "mike@example.com",
      role: "member",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike",
      joinedAt: new Date("2024-02-03").toISOString(),
    },
    {
      id: "member-3-3",
      name: "Nancy Scott",
      email: "nancy@example.com",
      role: "member",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nancy",
      joinedAt: new Date("2024-02-05").toISOString(),
    },
    {
      id: "member-3-4",
      name: "Oscar Taylor",
      email: "oscar@example.com",
      role: "member",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Oscar",
      joinedAt: new Date("2024-02-08").toISOString(),
    },
    {
      id: "member-3-5",
      name: "Paula White",
      email: "paula@example.com",
      role: "viewer",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Paula",
      joinedAt: new Date("2024-02-10").toISOString(),
    },
    {
      id: "member-3-6",
      name: "Quinn Adams",
      email: "quinn@example.com",
      role: "member",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Quinn",
      joinedAt: new Date("2024-02-12").toISOString(),
    },
  ],
  "team-4": [
    {
      id: "member-4-1",
      name: "Rachel Baker",
      email: "rachel@example.com",
      role: "admin",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rachel",
      joinedAt: new Date("2024-02-10").toISOString(),
    },
    {
      id: "member-4-2",
      name: "Sam Carter",
      email: "sam@example.com",
      role: "member",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sam",
      joinedAt: new Date("2024-02-12").toISOString(),
    },
    {
      id: "member-4-3",
      name: "Tom Davis",
      email: "tom@example.com",
      role: "member",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Tom",
      joinedAt: new Date("2024-02-15").toISOString(),
    },
    {
      id: "member-4-4",
      name: "Uma Foster",
      email: "uma@example.com",
      role: "viewer",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Uma",
      joinedAt: new Date("2024-02-18").toISOString(),
    },
  ],
};

// Helper functions
export const getTeamById = (id: string): Team | undefined => {
  return mockTeams.find((team) => team.id === id);
};

export const getAllTeams = (): Team[] => {
  return mockTeams;
};

export const getTeamMembers = (teamId: string): TeamMember[] => {
  return mockTeamMembers[teamId] || [];
};

export const addTeam = (team: Team): void => {
  mockTeams.push(team);
};

export const deleteTeamById = (id: string): Team[] => {
  const index = mockTeams.findIndex((team) => team.id === id);
  if (index > -1) {
    mockTeams.splice(index, 1);
    delete mockTeamMembers[id];
  }
  return mockTeams;
};

export const addTeamMember = (teamId: string, member: TeamMember): void => {
  if (!mockTeamMembers[teamId]) {
    mockTeamMembers[teamId] = [];
  }
  mockTeamMembers[teamId].push(member);

  // Update team member count
  const team = getTeamById(teamId);
  if (team) {
    team.memberCount = mockTeamMembers[teamId].length;
  }
};

export const removeTeamMember = (teamId: string, memberId: string): void => {
  if (mockTeamMembers[teamId]) {
    mockTeamMembers[teamId] = mockTeamMembers[teamId].filter(
      (m) => m.id !== memberId
    );

    // Update team member count
    const team = getTeamById(teamId);
    if (team) {
      team.memberCount = mockTeamMembers[teamId].length;
    }
  }
};

export const updateTeamMemberRole = (
  teamId: string,
  memberId: string,
  newRole: "admin" | "member" | "viewer"
): void => {
  if (mockTeamMembers[teamId]) {
    const member = mockTeamMembers[teamId].find((m) => m.id === memberId);
    if (member) {
      member.role = newRole;
    }
  }
};

export const updateTeam = (
  teamId: string,
  updatedTeam: Team
): Team | undefined => {
  const index = mockTeams.findIndex((team) => team.id === teamId);
  if (index > -1) {
    mockTeams[index] = { ...mockTeams[index], ...updatedTeam };
    return mockTeams[index];
  }
  return undefined;
};

// Helper to get user info by email from all teams
export const getUserByEmail = (email: string): { name: string; email: string; avatar?: string } | undefined => {
  // Search in all team members
  for (const teamId in mockTeamMembers) {
    const member = mockTeamMembers[teamId].find((m) => m.email === email);
    if (member) {
      return {
        name: member.name,
        email: member.email,
        avatar: member.avatar,
      };
    }
  }
  return undefined;
};
