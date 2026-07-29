import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
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
import { User, Key, Shield, ShieldCheck, ArrowLeft, LogOut, Palette, CreditCard } from "lucide-react";
import ProfileSettings from "../components/settings/ProfileSettings.jsx";
import PasswordSettings from "../components/settings/PasswordSettings.jsx";
import SecuritySettings from "../components/settings/SecuritySettings.jsx";
import TwoFactorSettings from "../components/settings/TwoFactorSettings.jsx";
import ThemeSettings from "../components/settings/ThemeSettings.jsx";
import SubscriptionSettings from "../components/settings/SubscriptionSettings.jsx";

const initialProfileState = {
  name: "",
  profileImage: "",
};

function SettingsPage() {
  const { token, user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [profileForm, setProfileForm] = useState(initialProfileState);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
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
  }, [token, setUser]);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAccountData();
    loadSecurityData();
  }, [loadAccountData, loadSecurityData]);

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
  const doesPasswordMatch = passwordForm.confirmPassword.length > 0 && passwordForm.newPassword === passwordForm.confirmPassword;

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    try {
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
    setActiveTab(tabId);
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

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "password", label: "Password" },
    { id: "security", label: "Security" },
    { id: "twoFactor", label: "Two-factor" },
    { id: "subscription", label: "Billing & Plans" },
    { id: "theme", label: "Appearance" },
  ];

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
      await changeEmailRequest({
        currentPassword: emailForm.currentPassword.trim(),
        newEmail: emailForm.newEmail.trim().toLowerCase(),
      }, token);
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
      await changeEmailConfirm({
        otp: emailOtp.trim(),
        newEmail: emailForm.newEmail.trim().toLowerCase(),
      }, token);
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
    <div className="min-h-screen bg-slate-950 px-4 sm:px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        
        {/* Sleek top header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-blue-400 font-bold">
              Account Settings
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight">Control Center</h1>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => navigate("/dashboard")} 
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-xs font-semibold hover:bg-white/5 hover:border-white/20 transition duration-150"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </button>
            <button 
              onClick={async () => { await logout(); navigate("/auth"); }} 
              className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/10 transition duration-150"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>

        {/* Industrial Sidebar layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
          
          {/* Sidebar Nav */}
          <div className="flex flex-row md:flex-col gap-1 md:gap-1.5 overflow-x-auto md:overflow-visible pb-4 md:pb-0 border-b md:border-b-0 md:border-r border-white/5 pr-0 md:pr-6">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              let Icon = User;
              if (tab.id === "password") Icon = Key;
              if (tab.id === "security") Icon = Shield;
              if (tab.id === "twoFactor") Icon = ShieldCheck;
              if (tab.id === "subscription") Icon = CreditCard;
              if (tab.id === "theme") Icon = Palette;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-xs font-semibold transition shrink-0 duration-150 w-full md:text-left ${
                    isActive 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/10" 
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Settings Panel */}
          <div className="md:col-span-3 space-y-6">
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
              />
            )}

            {activeTab === "password" && (
              <PasswordSettings
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

            {activeTab === "theme" && (
              <ThemeSettings />
            )}

            {activeTab === "subscription" && (
              <SubscriptionSettings setActiveTab={handleTabChange} />
            )}
          </div>

        </div>

      </div>
    </div>
  );
}

export default SettingsPage;
