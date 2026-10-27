import { Sun, Moon, Laptop, Check, Monitor } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

const modes = [
  { id: "light", label: "Light", desc: "A fresh, clear canvas for your workday.", icon: Sun },
  { id: "dark", label: "Dark", desc: "A calm workspace for focused work.", icon: Moon },
  { id: "system", label: "System", desc: "Automatically match your device settings.", icon: Laptop },
];

function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  return (
    <section className="settings-appearance profile-card">
      <div className="settings-card-intro"><span className="settings-eyebrow">PERSONAL PREFERENCES</span><h2>Choose your canvas</h2><p>The same workspace. A different point of view.</p></div>
      <div className="settings-theme-options" role="group" aria-label="Color theme">
        {modes.map(mode => {
          const Icon = mode.icon;
          const selected = theme === mode.id;
          return <button type="button" key={mode.id} className={"settings-theme-option " + (selected ? "is-selected" : "")} aria-pressed={selected} onClick={() => setTheme(mode.id)}>
            <span className={"settings-theme-preview preview-" + mode.id} aria-hidden="true">
              <span className="theme-preview-bar"><i /><i /><i /></span>
              <span className="theme-preview-body"><span className="theme-preview-nav"><i /><i /><i /><i /></span><span className="theme-preview-main"><i /><span><i /><i /></span><i /><i /></span></span>
            </span>
            <span className="settings-theme-name"><Icon size={16} /><strong>{mode.label}</strong><span className="settings-theme-check">{selected && <Check size={12} />}</span></span>
            <span className="settings-theme-description">{mode.desc}</span>
          </button>;
        })}
      </div>
      <div className="settings-theme-footer"><Monitor size={16} /><p>Your preference applies across the workspace and is saved on this device.</p><span><Check size={12} /> Applied automatically</span></div>
    </section>
  );
}

export default ThemeSettings;
