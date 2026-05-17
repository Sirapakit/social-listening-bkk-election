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
      className="flex flex-col items-center py-4 gap-1 shrink-0 h-screen sticky top-0 z-40"
      style={{
        width: "var(--sidebar-w)",
        background: "var(--sidebar-bg)",
        borderRight: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* Logo mark */}
      <div className="w-8 h-8 mb-5 flex items-center justify-center">
        <div
          className="w-6 h-6 rounded-sm"
          style={{ background: "var(--pos-dot)" }}
          title="Bangkok Election 2026"
        />
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 w-full px-2">
        {navItems.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            title={label}
            className="w-full h-9 rounded-lg flex items-center justify-center transition-colors"
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
      <div className="flex-1" />

      {/* Settings */}
      <button
        title="Settings"
        className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors mb-1"
        style={{ color: "var(--sidebar-icon)" }}
      >
        <Settings className="w-4 h-4" strokeWidth={1.5} />
      </button>

      {/* User avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold mb-1"
        style={{ background: "var(--pos-2)", color: "#fff" }}
        title="User"
      >
        BK
      </div>
    </aside>
  );
}
