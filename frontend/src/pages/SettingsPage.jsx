import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  changePassword,
  disableTwoFactor,
  enableTwoFactor,
  getLoginHistory,
  getProfile,
  getSecuritySessions,
  revokeAllSecuritySessions,
  revokeAllAbsoluteSecuritySessions,
  revokeSecuritySession,
  setupTwoFactor,
  updateProfile,
  changeEmailRequest,
  changeEmailConfirm,
  deleteAccount,
} from "../services/authApi";
import {
  User,
  Key,
  KeyRound,
  Shield,
  ShieldCheck,
  Palette,
  Globe2,
  Activity,
  Users,
  Bot,
  Search,
  ChevronRight,
  SlidersHorizontal,
  Info,
  ArrowLeft,
  LayoutDashboard,
} from "lucide-react";
import ProfileSettings from "../components/settings/ProfileSettings.jsx";
import PasswordSettings from "../components/settings/PasswordSettings.jsx";
import SecuritySettings from "../components/settings/SecuritySettings.jsx";
import TwoFactorSettings from "../components/settings/TwoFactorSettings.jsx";
import ThemeSettings from "../components/settings/ThemeSettings.jsx";
import DomainSettings from "../components/settings/DomainSettings.jsx";
import ApiKeySettings from "../components/settings/ApiKeySettings.jsx";
import McpSettings from "../components/settings/McpSettings.jsx";
import WebhookSettings from "../components/settings/WebhookSettings.jsx";
import TeamSettings from "../components/settings/TeamSettings.jsx";
import "./home.css";
import "./profile.css";
import "./settings.css";
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import { settingsPath } from '../routes/navigation';

const initialProfileState = {
  name: "",
  profileImage: "",
};

const SETTINGS_GROUPS = ["Account", "Workspace", "Developers"];
const SETTINGS_TABS = [
  { id: "profile", label: "Profile", group: "Account", icon: User, description: "Your personal details, profile image, and email address.", hint: "Keep your details current so your team can recognize you." },
  { id: "password", label: "Password", group: "Account", icon: KeyRound, description: "Update your password and keep your account protected.", hint: "Use a unique password with a mix of letters, numbers, and symbols." },
  { id: "security", label: "Sessions & security", group: "Account", icon: Shield, description: "Review connected devices, sign-in activity, and security alerts.", hint: "Remove sessions you no longer use. Account deletion is at the bottom of this section." },
  { id: "twoFactor", label: "Two-factor authentication", group: "Account", icon: ShieldCheck, description: "Add an extra layer of protection with an authenticator app.", hint: "Save your backup codes somewhere safe before you need them." },
  { id: "theme", label: "Appearance", group: "Account", icon: Palette, description: "Make your workspace feel right with a theme that suits you.", hint: "Theme changes apply immediately. Choose System to follow your device." },
  { id: "domains", label: "Custom domains", group: "Workspace", icon: Globe2, description: "Bring your brand to every short link with a custom domain.", hint: "You will need access to your domain's DNS settings to verify ownership." },
  { id: "teams", label: "Team members", group: "Workspace", icon: Users, description: "Organize shared workspaces, invitations, and member access.", hint: "Give each team member only the access their work requires." },
  { id: "apiKeys", label: "API keys", group: "Developers", icon: Key, description: "Create and manage credentials for your applications.", hint: "Keep API keys private and revoke credentials you no longer use." },
  { id: "webhooks", label: "Webhooks", group: "Developers", icon: Activity, description: "Send workspace events to the tools your team already uses.", hint: "Use an HTTPS endpoint and verify webhook signatures in your integration." },
  { id: "mcp", label: "AI & MCP integration", group: "Developers", icon: Bot, description: "Connect your AI tools to PBUrls and automate your workflow.", hint: "Copy the configuration for your AI client and keep embedded credentials private." },
];

function resolveSettingsTab(search, fallback = "profile") {
  const requested = new URLSearchParams(search).get("tab") || fallback;
  return SETTINGS_TABS.some(tab => tab.id === requested) ? requested : "profile";
}

function SettingsPage({ defaultTab }) {
  const { token, user, logout, setUser } = useAuth();
  const { theme } = useTheme();
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : true
  );
  const isDark = theme === "dark" || (theme === "system" && systemDark);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = defaultTab || resolveSettingsTab(location.search);
  const currentTab = SETTINGS_TABS.find(tab => tab.id === activeTab);
  const [settingsSearch, setSettingsSearch] = useState("");
  const matchingTabs = SETTINGS_TABS.filter(tab =>
    (tab.label + " " + tab.group + " " + tab.description).toLowerCase().includes(settingsSearch.trim().toLowerCase())
  );

  const [profileForm, setProfileForm] = useState(initialProfileState);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [loadingSecurity, setLoadingSecurity] = useState(true);
  const [securityMessage, setSecurityMessage] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [twoFactorMessage, setTwoFactorMessage] = useState("");
  const [twoFactorError, setTwoFactorError] = useState("");
  const [twoFactorSetup, setTwoFactorSetup] = useState(null);
  const [loadingTwoFactorSetup, setLoadingTwoFactorSetup] = useState(false);
  const [twoFactorSetupError, setTwoFactorSetupError] = useState("");
  const [enablingTwoFactor, setEnablingTwoFactor] = useState(false);
  const [disablingTwoFactor, setDisablingTwoFactor] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);

  // Email Change States
  const [emailForm, setEmailForm] = useState({ newEmail: "", currentPassword: "" });
  const [emailOtp, setEmailOtp] = useState("");
  const [emailStep, setEmailStep] = useState(1);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loadingEmailChange, setLoadingEmailChange] = useState(false);

  // Delete Account States
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const loadAccountData = useCallback(async () => {
    if (!token) return;
    try {
      const profileRes = await getProfile(token);
      const profileData = profileRes.data?.data || {};
      setProfileForm({
        name: profileData.name || "",
        profileImage: profileData.profileImage || "",
      });
      setUser(profileData);
    } catch (error) {
      setProfileError(error.response?.data?.message || "Unable to load profile.");
    }
  }, [token, setUser, setProfileForm]);

  const loadSecurityData = useCallback(async () => {
    if (!token) return;
    try {
      setSecurityMessage("");
      setSecurityError("");
      setLoadingSecurity(true);
      const [sessionsRes, historyRes] = await Promise.all([getSecuritySessions(token), getLoginHistory(token)]);
      setSessions(sessionsRes.data?.data || []);
      setLoginHistory(historyRes.data?.data || []);
    } catch (error) {
      setSecurityError(error.response?.data?.message || "Unable to load security data.");
    } finally {
      setLoadingSecurity(false);
    }
  }, [token]);

  useEffect(() => {
    // Fetch this section's remote profile when the session changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAccountData();
  }, [loadAccountData]);

  useEffect(() => {
    if (activeTab !== "security" || !token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSecurityData();
  }, [activeTab, token, loadSecurityData]);

  const loadTwoFactorSetup = useCallback(async () => {
    if (!token || user?.twoFactorEnabled) {
      setTwoFactorSetup(null);
      setTwoFactorSetupError("");
      return;
    }

    try {
      setLoadingTwoFactorSetup(true);
      setTwoFactorSetupError("");
      const response = await setupTwoFactor(token);
      setTwoFactorSetup(response.data?.data || null);
    } catch (error) {
      setTwoFactorSetup(null);
      setTwoFactorSetupError(error.response?.data?.message || "Unable to generate authenticator setup.");
    } finally {
      setLoadingTwoFactorSetup(false);
    }
  }, [token, user?.twoFactorEnabled]);

  useEffect(() => {
    if (activeTab !== "twoFactor" || !token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTwoFactorSetup();
  }, [activeTab, token, user?.twoFactorEnabled, loadTwoFactorSetup]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileMessage("");
    setProfileError("");

    const trimmedName = profileForm.name.trim();
    if (trimmedName.length < 2) {
      setProfileError("Display name must be at least 2 characters.");
      return;
    }

    if (!/^[a-zA-Z '-]+$/.test(trimmedName)) {
      setProfileError("Display name may only contain letters, spaces, hyphens, and apostrophes.");
      return;
    }

    const payload = {
      name: trimmedName,
      profileImage: profileForm.profileImage || null,
    };

    try {
      setSavingProfile(true);
      const response = await updateProfile(payload, token);
      const updatedProfile = response.data?.data || payload;
      setUser(updatedProfile);
      setProfileForm({
        name: updatedProfile.name || trimmedName,
        profileImage: updatedProfile.profileImage || "",
      });
      setProfileMessage("Profile updated successfully.");
    } catch (error) {
      setProfileError(error.response?.data?.message || "Unable to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const passwordCriteria = {
    length: passwordForm.newPassword.length >= 8,
    uppercase: /[A-Z]/.test(passwordForm.newPassword),
    lowercase: /[a-z]/.test(passwordForm.newPassword),
    number: /[0-9]/.test(passwordForm.newPassword),
    special: /[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]/.test(passwordForm.newPassword),
  };
  const doesPasswordMatch =
    passwordForm.confirmPassword.length > 0 && passwordForm.newPassword === passwordForm.confirmPassword;

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    try {
      setSavingPassword(true);
      await changePassword(
        {
          currentPassword: passwordForm.currentPassword.trim(),
          newPassword: passwordForm.newPassword.trim(),
        },
        token
      );
      setPasswordMessage("Password changed successfully. Please sign in again.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      await logout();
      navigate("/auth");
    } catch (error) {
      setPasswordError(error.response?.data?.message || "Unable to change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    try {
      await revokeSecuritySession(sessionId, token);
      setSessions((prev) => prev.filter((item) => item.id !== sessionId));
      setSecurityMessage("Session revoked.");
    } catch (error) {
      setSecurityError(error.response?.data?.message || "Unable to revoke session.");
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      await revokeAllSecuritySessions(token);
      await loadSecurityData();
      setSecurityMessage("All other sessions were revoked.");
    } catch (error) {
      setSecurityError(error.response?.data?.message || "Unable to revoke sessions.");
    }
  };

  const handleTabChange = (tabId) => {
    navigate(settingsPath(tabId));
    setProfileMessage("");
    setProfileError("");
    setPasswordMessage("");
    setPasswordError("");
    setSecurityMessage("");
    setSecurityError("");
    setTwoFactorMessage("");
    setTwoFactorError("");
    setEmailMessage("");
    setEmailError("");
    setDeleteMessage("");
    setDeleteError("");
  };

  const handleToggleEmailAlerts = async (enabled) => {
    setSecurityMessage("");
    setSecurityError("");
    try {
      const response = await updateProfile({ securityEmailAlerts: enabled }, token);
      const updatedProfile = response.data?.data || {};
      setUser(updatedProfile);
      setSecurityMessage("Security email alert settings updated.");
    } catch (error) {
      setSecurityError(error.response?.data?.message || "Unable to update email alert settings.");
    }
  };

  const handleRevokeAllAbsoluteSessions = async () => {
    try {
      setSecurityMessage("");
      setSecurityError("");
      await revokeAllAbsoluteSecuritySessions(token);
      setSecurityMessage("All sessions terminated. Redirecting...");
      setTimeout(async () => {
        await logout();
        navigate("/auth");
      }, 2000);
    } catch (error) {
      setSecurityError(error.response?.data?.message || "Unable to revoke sessions.");
    }
  };

  const handleEnableTwoFactor = async (otp) => {
    setTwoFactorMessage("");
    setTwoFactorError("");
    if (!otp || otp.trim().length !== 6) {
      setTwoFactorError("Enter a valid 6-digit code to enable 2FA.");
      return;
    }

    try {
      setEnablingTwoFactor(true);
      await enableTwoFactor({ otp: otp.trim() }, token);
      const profileRes = await getProfile(token);
      const profileData = profileRes.data?.data || {};
      setUser(profileData);
      setTwoFactorSetup(null);
      setTwoFactorMessage("Two-factor authentication is now enabled.");
    } catch (error) {
      setTwoFactorError(error.response?.data?.message || "Unable to enable two-factor authentication.");
    } finally {
      setEnablingTwoFactor(false);
    }
  };

  const handleDisableTwoFactor = async (otp) => {
    setTwoFactorMessage("");
    setTwoFactorError("");
    if (!otp || otp.trim().length !== 6) {
      setTwoFactorError("Enter a valid 6-digit code from your authenticator app.");
      return;
    }

    try {
      setDisablingTwoFactor(true);
      await disableTwoFactor({ otp: otp.trim() }, token);
      const profileRes = await getProfile(token);
      const profileData = profileRes.data?.data || {};
      setUser(profileData);
      setTwoFactorMessage("Two-factor authentication has been disabled.");
      await loadTwoFactorSetup();
    } catch (error) {
      setTwoFactorError(error.response?.data?.message || "Unable to disable two-factor authentication.");
    } finally {
      setDisablingTwoFactor(false);
    }
  };

  // Email Change Handlers
  const handleEmailChangeRequest = async (e) => {
    if (e) e.preventDefault();
    setEmailMessage("");
    setEmailError("");
    try {
      setLoadingEmailChange(true);
      await changeEmailRequest(
        {
          currentPassword: emailForm.currentPassword.trim(),
          newEmail: emailForm.newEmail.trim().toLowerCase(),
        },
        token
      );
      setEmailStep(2);
      setEmailMessage("Verification code sent to your new email address.");
    } catch (error) {
      setEmailError(error.response?.data?.message || "Failed to request email change.");
    } finally {
      setLoadingEmailChange(false);
    }
  };

  const handleEmailChangeConfirm = async (e) => {
    if (e) e.preventDefault();
    setEmailMessage("");
    setEmailError("");
    try {
      setLoadingEmailChange(true);
      await changeEmailConfirm(
        {
          otp: emailOtp.trim(),
          newEmail: emailForm.newEmail.trim().toLowerCase(),
        },
        token
      );
      setEmailMessage("Email changed successfully. Redirecting to login...");
      setTimeout(async () => {
        await logout();
        navigate("/auth");
      }, 2500);
    } catch (error) {
      setEmailError(error.response?.data?.message || "Failed to confirm email change.");
    } finally {
      setLoadingEmailChange(false);
    }
  };

  // Delete Account Handler
  const handleDeleteAccountSubmit = async (e) => {
    if (e) e.preventDefault();
    setDeleteMessage("");
    setDeleteError("");
    if (!deletePassword) {
      setDeleteError("Password is required to delete your account.");
      return;
    }
    try {
      setDeletingAccount(true);
      await deleteAccount({ currentPassword: deletePassword }, token);
      setDeleteMessage("Your account has been deleted. Redirecting...");
      setTimeout(async () => {
        await logout();
        navigate("/auth");
      }, 2500);
    } catch (error) {
      setDeleteError(error.response?.data?.message || "Failed to delete account. Please verify your password.");
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className={`lp-page ${isDark ? "lp-dark" : "lp-light"} profile-page-shell`}>
      <a className="site-skip" href="#settings-content">Skip to settings</a>
      <SiteHeader workspace />

      {/* Main Settings Page Container */}
      <main className="profile-container" id="main-content">
        <nav className="profile-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/dashboard" className="profile-breadcrumb-home"><LayoutDashboard size={12} />Workspace</Link>
          <ChevronRight size={11} aria-hidden="true" />
          <Link to="/settings/profile">Settings</Link>
          <ChevronRight size={11} aria-hidden="true" />
          <span aria-current="page">{currentTab.label}</span>
        </nav>
        <section className="settings-heading">
          <div>
            <span className="settings-eyebrow"><SlidersHorizontal size={13} /> YOUR WORKSPACE, YOUR WAY</span>
            <h1>Workspace settings<span>.</span></h1>
            <p>Your account, workspace, and integrations. One place to manage them.</p>
          </div>
          <div className="settings-account-chip">
            <span className="settings-account-avatar">{(user?.name || "U").slice(0, 1).toUpperCase()}</span>
            <div><strong>{user?.name || "Your account"}</strong><span>{user?.email || "Personal workspace"}</span></div>
            <span className="settings-account-role">{user?.role || "USER"}</span>
          </div>
        </section>

        {/* Master Two-Column Layout */}
        <div className="profile-main-layout">
          {/* Navigation Sidebar */}
          <aside className="profile-sidebar" aria-label="Settings navigation">
            <Link to="/dashboard" className="settings-back-pill">
              <ArrowLeft size={13} />Back to workspace
            </Link>
            <label className="settings-search">
              <Search size={15} />
              <input type="search" placeholder="Find a setting…" aria-label="Find a setting" value={settingsSearch} onChange={e => setSettingsSearch(e.target.value)} />
            </label>
            {SETTINGS_GROUPS.map(group => {
              const groupTabs = matchingTabs.filter(tab => tab.group === group);
              if (!groupTabs.length) return null;
              return <div className="settings-nav-group" key={group}>
                <span className="profile-sidebar-label">{group}</span>
                {groupTabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return <Link key={tab.id} to={settingsPath(tab.id)} aria-current={isActive ? "page" : undefined} className={"profile-tab-button " + (isActive ? "is-selected" : "")}>
                    <Icon size={16} /><span>{tab.label}</span>{isActive && <ChevronRight size={14} className="settings-nav-arrow" />}
                  </Link>;
                })}
              </div>;
            })}
            {!matchingTabs.length && <p className="settings-no-results" role="status">No matching settings. Try “security” or “domains”.</p>}
            <div className="profile-sidebar-footer">
              <ShieldCheck size={14} style={{ color: "var(--lp-accent)" }} />
              <span>PBUrls Secure Session</span>
            </div>
          </aside>

          {/* Active Settings Panel */}
          <div className="profile-panel-container" id="settings-content">
            <div className="settings-section-heading">
              <span className="settings-section-icon"><currentTab.icon size={23} /></span>
              <div><span className="settings-eyebrow">{currentTab.group}</span><h2>{currentTab.label}</h2><p>{currentTab.description}</p></div>
            </div>
            <div className="settings-content" key={activeTab}>
            {activeTab === "profile" && (
              <ProfileSettings
                user={user}
                profileForm={profileForm}
                setProfileForm={setProfileForm}
                onSubmit={handleProfileSubmit}
                saving={savingProfile}
                message={profileMessage}
                error={profileError}
                emailForm={emailForm}
                setEmailForm={setEmailForm}
                emailOtp={emailOtp}
                setEmailOtp={setEmailOtp}
                emailStep={emailStep}
                setEmailStep={setEmailStep}
                emailMessage={emailMessage}
                emailError={emailError}
                loadingEmailChange={loadingEmailChange}
                onEmailRequest={handleEmailChangeRequest}
                onEmailConfirm={handleEmailChangeConfirm}
                onTabChange={handleTabChange}
              />
            )}

            {activeTab === "password" && (
              <PasswordSettings
                saving={savingPassword}
                passwordForm={passwordForm}
                setPasswordForm={setPasswordForm}
                onSubmit={handlePasswordSubmit}
                message={passwordMessage}
                error={passwordError}
                passwordCriteria={passwordCriteria}
                doesPasswordMatch={doesPasswordMatch}
                showCurrentPassword={showCurrentPassword}
                showNewPassword={showNewPassword}
                showConfirmPassword={showConfirmPassword}
                toggleShowCurrentPassword={() => setShowCurrentPassword((prev) => !prev)}
                toggleShowNewPassword={() => setShowNewPassword((prev) => !prev)}
                toggleShowConfirmPassword={() => setShowConfirmPassword((prev) => !prev)}
              />
            )}

            {activeTab === "security" && (
              <SecuritySettings
                user={user}
                sessions={sessions}
                loginHistory={loginHistory}
                loadingSecurity={loadingSecurity}
                securityMessage={securityMessage}
                securityError={securityError}
                onRevokeSession={handleRevokeSession}
                onRevokeAllSessions={handleRevokeAllSessions}
                onRevokeAllAbsoluteSessions={handleRevokeAllAbsoluteSessions}
                onToggleEmailAlerts={handleToggleEmailAlerts}
                showDeleteConfirm={showDeleteConfirm}
                setShowDeleteConfirm={setShowDeleteConfirm}
                deletePassword={deletePassword}
                setDeletePassword={setDeletePassword}
                deleteMessage={deleteMessage}
                deleteError={deleteError}
                deletingAccount={deletingAccount}
                onDeleteAccount={handleDeleteAccountSubmit}
              />
            )}

            {activeTab === "twoFactor" && (
              <TwoFactorSettings
                user={user}
                setupData={twoFactorSetup}
                loadingSetup={loadingTwoFactorSetup}
                setupError={twoFactorSetupError}
                onRefreshSetup={loadTwoFactorSetup}
                onEnable={handleEnableTwoFactor}
                onDisable={handleDisableTwoFactor}
                enabling={enablingTwoFactor}
                disabling={disablingTwoFactor}
                message={twoFactorMessage}
                error={twoFactorError}
                backupCodes={backupCodes}
                setBackupCodes={setBackupCodes}
              />
            )}

            {activeTab === "theme" && <ThemeSettings />}


            {activeTab === "domains" && <DomainSettings />}

            {activeTab === "apiKeys" && <ApiKeySettings />}

            {activeTab === "mcp" && <McpSettings />}

            {activeTab === "webhooks" && <WebhookSettings />}

            {activeTab === "teams" && <TeamSettings />}
            </div>
            <aside className="settings-guidance"><Info size={18} /><div><strong>Good to know</strong><p>{currentTab.hint}</p></div></aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default SettingsPage;
