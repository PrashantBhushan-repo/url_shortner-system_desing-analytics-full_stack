import { useState, useEffect } from "react";
import { Users, Plus, AlertCircle, CheckCircle2, Loader2, Trash2, Mail, Check, Shield, UserPlus } from "lucide-react";
import API from "../../services/urlApi";

function TeamSettings() {
  const [memberships, setMemberships] = useState([]);
  const [activeTeam, setActiveTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create Team state
  const [teamName, setTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviting, setInviting] = useState(false);

  // General action loaders
  const [actionId, setActionId] = useState(null);

  const fetchTeams = async () => {
    try {
      setLoadingTeams(true);
      setError("");
      const response = await API.get("/teams");
      const data = response.data?.data || [];
      setMemberships(data);

      // Default to the first accepted team if none selected
      const accepted = data.find((m) => m.status === "ACCEPTED");
      if (accepted && !activeTeam) {
        setActiveTeam(accepted);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load team workspaces. Verify if your plan supports teams.");
    } finally {
      setLoadingTeams(false);
    }
  };

  const fetchMembers = async (teamId) => {
    try {
      setLoadingMembers(true);
      setError("");
      const response = await API.get(`/teams/${teamId}/members`);
      setTeamMembers(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load team members.");
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    if (activeTeam) {
      fetchMembers(activeTeam.id);
    }
  }, [activeTeam]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    setError("");
    setSuccess("");
    setCreatingTeam(true);

    try {
      const response = await API.post("/teams", { name: teamName.trim() });
      setSuccess(`Team Workspace "${teamName}" created!`);
      setTeamName("");
      // Reload teams list
      await fetchTeams();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create team.");
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleInviteMember = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeTeam) return;

    setError("");
    setSuccess("");
    setInviting(true);

    try {
      await API.post("/teams/invite", {
        teamId: activeTeam.id,
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setSuccess(`Invitation sent to ${inviteEmail}.`);
      setInviteEmail("");
      // Reload members list
      await fetchMembers(activeTeam.id);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send invitation.");
    } finally {
      setInviting(false);
    }
  };

  const handleAcceptInvite = async (teamId) => {
    setError("");
    setSuccess("");
    setActionId(teamId);

    try {
      await API.post("/teams/accept", { teamId });
      setSuccess("Invitation accepted! Welcome to the team.");
      await fetchTeams();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to accept invitation.");
    } finally {
      setActionId(null);
    }
  };

  const handleRevokeMember = async (userId) => {
    if (!activeTeam) return;
    if (!window.confirm("Are you sure you want to remove this member or cancel their pending invitation?")) {
      return;
    }

    setError("");
    setSuccess("");
    setActionId(userId);

    try {
      await API.post("/teams/revoke", {
        teamId: activeTeam.id,
        userId,
      });
      setSuccess("Member removed successfully.");
      setTeamMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove member.");
    } finally {
      setActionId(null);
    }
  };

  const pendingInvites = memberships.filter((m) => m.status === "PENDING");
  const acceptedTeams = memberships.filter((m) => m.status === "ACCEPTED");

  // Check if current user is owner or admin of the active team
  const isTeamManager = activeTeam && (activeTeam.role === "OWNER" || activeTeam.role === "ADMIN");

  return (
    <div className="settings-radius border settings-border settings-surface p-6 shadow-xl space-y-6">
      <div className="border-b settings-border pb-5">
        <h2 className="text-xl font-bold settings-ink flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-400" /> Team Workspace Space
        </h2>
        <p className="mt-1 text-xs settings-muted">
          Collaborate on link management and analytics. Invite members and control project parameters together.
        </p>
      </div>

      <div className="space-y-4">
        {success && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Pending Invites Alert Bar */}
      {pendingInvites.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-wider text-amber-400 font-bold">Pending Team Invitations</h3>
          <div className="grid gap-3">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300"
              >
                <div>
                  <span className="font-bold settings-ink">{invite.name}</span> has invited you as a{" "}
                  <span className="font-mono text-xs bg-amber-500/10 px-1.5 py-0.5 rounded text-amber-400 uppercase font-bold">{invite.role}</span>
                </div>
                <button
                  onClick={() => handleAcceptInvite(invite.id)}
                  disabled={actionId === invite.id}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {actionId === invite.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                  Accept
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Creating team if none exists or options */}
      {acceptedTeams.length === 0 && !loadingTeams ? (
        <div className="rounded-2xl border settings-border settings-surface p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full settings-surface border settings-border flex items-center justify-center settings-muted mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold settings-ink">Create a Team Workspace</h4>
            <p className="text-xs settings-muted mt-1">You are not a member of any active team workspaces. Create one below to begin.</p>
          </div>
          <form onSubmit={handleCreateTeam} className="flex gap-3 max-w-md mx-auto">
            <input
              type="text"
              placeholder="e.g. Acme Marketing Team"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="flex-1 rounded-2xl border settings-border settings-surface px-4 py-2.5 text-sm settings-ink outline-none focus:border-blue-500"
              required
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 settings-ink rounded-2xl px-5 py-2.5 text-xs font-bold uppercase transition duration-150 flex items-center gap-1.5 cursor-pointer shrink-0"
              disabled={creatingTeam}
            >
              {creatingTeam ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create
            </button>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column: Team selection list & Create team */}
          <div className="space-y-4 lg:border-r lg:border-white/5 lg:pr-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs uppercase tracking-wider settings-muted font-bold">Your Workspaces</h3>
            </div>

            {loadingTeams ? (
              <div className="p-8 text-center text-xs settings-muted flex flex-col items-center gap-2 animate-pulse">
                <Loader2 className="w-6 h-6 animate-spin settings-accent" />
                <span>Loading workspaces...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {acceptedTeams.map((membership) => {
                  const isSelected = activeTeam?.id === membership.id;
                  return (
                    <button
                      key={membership.id}
                      onClick={() => setActiveTeam(membership)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition duration-150 flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? "settings-surface border-indigo-500 settings-ink shadow-lg"
                          : "settings-surface settings-border hover:border-white/20 settings-muted hover:text-white"
                      }`}
                    >
                      <div className="truncate">
                        <span className="font-bold block truncate text-xs">{membership.name}</span>
                        <span className="text-[9px] uppercase tracking-wider settings-muted font-mono">Role: {membership.role}</span>
                      </div>
                      <Shield className={`w-3.5 h-3.5 shrink-0 ${membership.role === "OWNER" ? "text-indigo-400" : "settings-muted"}`} />
                    </button>
                  );
                })}
              </div>
            )}

            <div className="border-t settings-border pt-4">
              <form onSubmit={handleCreateTeam} className="flex gap-2">
                <input
                  type="text"
                  placeholder="New Team Name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="flex-1 rounded-xl border settings-border settings-surface px-3 py-2 text-xs settings-ink outline-none focus:border-blue-500"
                  required
                />
                <button
                  type="submit"
                  className="settings-surface hover:bg-slate-700 settings-ink p-2 rounded-xl transition duration-150 cursor-pointer"
                  disabled={creatingTeam}
                  title="Create Team"
                >
                  {creatingTeam ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Member roster & Invite tool */}
          <div className="lg:col-span-2 space-y-6">
            {activeTeam && (
              <>
                {/* Invite form */}
                {isTeamManager && (
                  <form onSubmit={handleInviteMember} className="rounded-2xl border settings-border settings-surface p-4 space-y-3">
                    <h3 className="text-xs uppercase tracking-wider settings-ink font-bold flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-indigo-400" /> Invite Collaborator
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-7">
                        <input
                          type="email"
                          placeholder="Collaborator's email address"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="w-full rounded-xl border settings-border settings-surface px-3 py-2 text-xs settings-ink outline-none focus:border-blue-500"
                          disabled={inviting}
                          required
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="w-full rounded-xl border settings-border settings-surface px-3 py-2 text-xs settings-ink outline-none focus:border-blue-500"
                          disabled={inviting}
                        >
                          <option value="MEMBER">Member</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          type="submit"
                          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 settings-ink rounded-xl py-2 text-xs font-bold transition cursor-pointer"
                          disabled={inviting}
                        >
                          {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : "Invite"}
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Team Roster */}
                <div className="space-y-3">
                  <h3 className="text-xs uppercase tracking-wider settings-muted font-bold">Roster list for {activeTeam.name}</h3>

                  {loadingMembers ? (
                    <div className="p-8 text-center text-xs settings-muted flex flex-col items-center gap-2 animate-pulse">
                      <Loader2 className="w-5 h-5 animate-spin settings-accent" />
                      <span>Synchronizing roster...</span>
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <div className="rounded-2xl border settings-border settings-surface p-8 text-center text-xs settings-muted">
                      Roster is empty.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {teamMembers.map((member) => {
                        const isOwner = member.role === "OWNER";
                        const showRevoke = isTeamManager && !isOwner && member.user_id !== activeTeam.owner.id;

                        return (
                          <div
                            key={member.id}
                            className="rounded-xl border settings-border settings-surface p-3.5 flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3 truncate">
                              <div className="w-8 h-8 rounded-full settings-surface border settings-border flex items-center justify-center settings-muted shrink-0 font-bold text-xs uppercase">
                                {member.user?.name ? member.user.name[0] : <Mail className="w-4 h-4" />}
                              </div>
                              <div className="truncate">
                                <span className="text-xs font-bold settings-ink block truncate">
                                  {member.user?.name || "Pending User"}
                                </span>
                                <span className="text-[10px] settings-muted block truncate">
                                  {member.user?.email || "Email undisclosed"}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-[9px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.5 rounded ${
                                  member.status === "ACCEPTED"
                                    ? "settings-surface settings-ink"
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                }`}
                              >
                                {member.status === "ACCEPTED" ? member.role : "Pending"}
                              </span>

                              {showRevoke && (
                                <button
                                  onClick={() => handleRevokeMember(member.user_id)}
                                  disabled={actionId === member.user_id}
                                  className="p-1.5 rounded-lg settings-surface hover:bg-rose-950/40 settings-muted hover:text-rose-400 border settings-border hover:border-rose-500/20 transition duration-150 cursor-pointer"
                                  title={member.status === "PENDING" ? "Cancel invitation" : "Remove member"}
                                >
                                  {actionId === member.user_id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamSettings;
