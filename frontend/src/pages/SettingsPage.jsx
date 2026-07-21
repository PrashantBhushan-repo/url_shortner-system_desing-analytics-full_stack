import { useEffect, useState } from "react";
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
  revokeSecuritySession,
  setupTwoFactor,
  updateProfile,
} from "../services/authApi";
import ProfileSettings from "../components/settings/ProfileSettings.jsx";
import PasswordSettings from "../components/settings/PasswordSettings.jsx";
import SecuritySettings from "../components/settings/SecuritySettings.jsx";
import TwoFactorSettings from "../components/settings/TwoFactorSettings.jsx";

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

  useEffect(() => {
    const loadAccountData = async () => {
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
    };

    const loadSecurityData = async () => {
      if (!token) return;
      try {
        setLoadingSecurity(true);
        const [sessionsRes, historyRes] = await Promise.all([getSecuritySessions(token), getLoginHistory(token)]);
        setSessions(sessionsRes.data?.data || []);
        setLoginHistory(historyRes.data?.data || []);
      } catch (error) {
        setSecurityError(error.response?.data?.message || "Unable to load security data.");
      } finally {
        setLoadingSecurity(false);
      }
    };

    loadAccountData();
    loadSecurityData();
  }, [token, setUser]);

  const loadTwoFactorSetup = async () => {
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
  };

  useEffect(() => {
    if (activeTab !== "twoFactor" || !token) return;
    loadTwoFactorSetup();
  }, [activeTab, token, user?.twoFactorEnabled]);

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
      setSessions([]);
      setSecurityMessage("All other sessions were revoked.");
    } catch (error) {
      setSecurityError(error.response?.data?.message || "Unable to revoke sessions.");
    }
  };

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "password", label: "Password" },
    { id: "security", label: "Security" },
    { id: "twoFactor", label: "Two-factor" },
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

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-blue-300">Account Settings</p>
            <h1 className="mt-2 text-3xl font-semibold">Manage your security and profile</h1>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate("/dashboard")} className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/10">Dashboard</button>
            <button onClick={async () => { await logout(); navigate("/auth"); }} className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/10">Logout</button>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm transition ${activeTab === tab.id ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-6">
          {activeTab === "profile" ? (
            <ProfileSettings
              user={user}
              profileForm={profileForm}
              setProfileForm={setProfileForm}
              onSubmit={handleProfileSubmit}
              saving={savingProfile}
              message={profileMessage}
              error={profileError}
            />
          ) : null}

          {activeTab === "password" ? (
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
          ) : null}

          {activeTab === "security" ? (
            <SecuritySettings
              sessions={sessions}
              loginHistory={loginHistory}
              loadingSecurity={loadingSecurity}
              securityMessage={securityMessage}
              securityError={securityError}
              onRevokeSession={handleRevokeSession}
              onRevokeAllSessions={handleRevokeAllSessions}
            />
          ) : null}

          {activeTab === "twoFactor" ? (
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
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
