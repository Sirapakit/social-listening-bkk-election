import { BarChart3, Hash, Activity, Database, Settings, Layers } from "lucide-react";

const navItems = [
  { icon: BarChart3, label: "Dashboard", active: true },
  { icon: Hash,      label: "Keywords" },
  { icon: Activity,  label: "Timeline" },
  { icon: Database,  label: "Data" },
  { icon: Layers,    label: "Reports" },
];

export function Sidebar() {
  return (
    <aside
      className="flex flex-row md:flex-col items-center justify-between md:justify-start py-2 md:py-4 px-3 md:px-0 gap-2 shrink-0 w-full md:w-[var(--sidebar-w)] md:h-screen sticky top-0 z-40 border-b md:border-b-0 md:border-r"
      style={{
        background: "var(--sidebar-bg)",
        borderColor: "rgba(255,255,255,0.05)",
      }}
    >
      {/* Logo mark */}
      <div className="w-8 h-8 md:mb-5 flex items-center justify-center shrink-0">
        <div
          className="w-6 h-6 rounded-sm"
          style={{ background: "var(--pos-dot)" }}
          title="Bangkok Election 2026"
        />
      </div>

      {/* Navigation */}
      <nav className="flex flex-row md:flex-col gap-1 md:gap-0.5 flex-1 md:flex-none w-auto md:w-full px-0 md:px-2 justify-center md:justify-start">
        {navItems.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            title={label}
            className="w-9 h-9 md:w-full md:h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{
              color: active ? "var(--sidebar-icon-active)" : "var(--sidebar-icon)",
              background: active ? "var(--sidebar-icon-hover)" : "transparent",
            }}
          >
            <Icon className="w-4 h-4" strokeWidth={active ? 2 : 1.5} />
          </button>
        ))}
      </nav>

      {/* Spacer */}
      <div className="hidden md:flex flex-1" />

      {/* Settings */}
      <button
        title="Settings"
        className="hidden md:flex w-9 h-9 rounded-lg items-center justify-center transition-colors mb-1"
        style={{ color: "var(--sidebar-icon)" }}
      >
        <Settings className="w-4 h-4" strokeWidth={1.5} />
      </button>

      {/* User avatar */}
      <div
        className="hidden md:flex w-7 h-7 rounded-full items-center justify-center text-[10px] font-bold mb-1"
        style={{ background: "var(--pos-2)", color: "#fff" }}
        title="User"
      >
        BK
      </div>
    </aside>
  );
}
