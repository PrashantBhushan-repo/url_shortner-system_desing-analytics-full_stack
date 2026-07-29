import { Sun, Moon, Laptop, Check } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

function ThemeSettings() {
  const { theme, setTheme } = useTheme();

  const modes = [
    {
      id: "light",
      label: "Bright Mode",
      desc: "Sleek light interface optimal for daylight environments.",
      icon: Sun,
      color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    },
    {
      id: "dark",
      label: "Dark Mode",
      desc: "High-contrast slate dark theme, comfortable in low-light environments.",
      icon: Moon,
      color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    },
    {
      id: "system",
      label: "System Default",
      desc: "Syncs automatically with your operating system's visual preference.",
      icon: Laptop,
      color: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    },
  ];

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
      <div className="border-b border-white/10 pb-5">
        <h2 className="text-xl font-bold text-white">Appearance</h2>
        <p className="mt-1 text-xs text-slate-400">Customize the visual theme of your SnapURL analytics dashboard.</p>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isSelected = theme === mode.id;

          return (
            <button
              key={mode.id}
              onClick={() => setTheme(mode.id)}
              className={`flex flex-col text-left p-5 rounded-2xl border transition duration-200 relative group cursor-pointer ${
                isSelected
                  ? "bg-slate-950/80 border-blue-500 shadow-lg shadow-blue-500/5"
                  : "bg-slate-950/40 border-white/5 hover:border-white/20 hover:bg-slate-950/60"
              }`}
            >
              {isSelected && (
                <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center border border-blue-500/30">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}

              <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${mode.color} transition duration-300 group-hover:scale-105`}>
                <Icon className="w-4 h-4" />
              </div>

              <h3 className="mt-4 text-sm font-bold text-white group-hover:text-blue-400 transition">{mode.label}</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed leading-normal">{mode.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ThemeSettings;
