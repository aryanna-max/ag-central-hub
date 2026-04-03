import { useState, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Radar, Briefcase, Map, PenTool, Receipt, Users, Database,
  ChevronLeft, ChevronRight, Target, Building2, CalendarDays,
  Car, FolderKanban, LayoutDashboard, UserPlus, Shield,
  FileText, BarChart3,
} from "lucide-react";
import { useModuleAlertCounts } from "@/hooks/useModuleAlertCounts";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarItem {
  label: string;
  path: string;
  icon: React.ElementType;
  allowedRoles: string[];
  children?: { label: string; path: string; icon: React.ElementType }[];
}

const navigation: SidebarItem[] = [
  {
    label: "Radar", path: "/", icon: Radar,
    allowedRoles: ["master", "diretor"],
  },
  {
    label: "Negócios", path: "/comercial", icon: Briefcase,
    allowedRoles: ["master", "diretor", "comercial"],
    children: [
      { label: "Leads", path: "/comercial/leads", icon: Target },
      { label: "Propostas", path: "/comercial/propostas", icon: FileText },
      { label: "Clientes", path: "/comercial/clientes", icon: Building2 },
    ],
  },
  {
    label: "Campo", path: "/operacional", icon: Map,
    allowedRoles: ["master", "diretor", "operacional"],
    children: [
      { label: "Projetos em Campo", path: "/operacional/projetos-campo", icon: FolderKanban },
      { label: "Planejamento", path: "/operacional/escala", icon: CalendarDays },
      { label: "Despesas de Campo", path: "/operacional/despesas-de-campo", icon: Receipt },
      { label: "Veículos", path: "/operacional/veiculos", icon: Car },
    ],
  },
  {
    label: "Prancheta", path: "/sala-tecnica", icon: PenTool,
    allowedRoles: ["master", "diretor", "sala_tecnica"],
    children: [
      { label: "Projetos", path: "/sala-tecnica", icon: FolderKanban },
      { label: "Minhas Tarefas", path: "/sala-tecnica/minhas-tarefas", icon: CalendarDays },
      { label: "Alertas", path: "/sala-tecnica/alertas", icon: Target },
    ],
  },
  {
    label: "Faturamento", path: "/financeiro", icon: Receipt,
    allowedRoles: ["master", "diretor", "financeiro"],
  },
  {
    label: "Pessoas", path: "/rh", icon: Users,
    allowedRoles: ["master", "diretor", "financeiro"],
    children: [
      { label: "Funcionários", path: "/rh/funcionarios", icon: UserPlus },
      { label: "Férias", path: "/rh/ferias", icon: CalendarDays },
      { label: "Ausências", path: "/rh/ausencias", icon: FileText },
    ],
  },
];

const adminNavigation: SidebarItem[] = [
  {
    label: "Base", path: "/admin", icon: Database,
    allowedRoles: ["master"],
    children: [
      { label: "Usuários", path: "/admin/usuarios", icon: UserPlus },
      { label: "Cadastros Base", path: "/admin/cadastros", icon: Database },
      { label: "Clientes", path: "/admin/clientes", icon: Building2 },
    ],
  },
];

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const location = useLocation();
  const alertCounts = useModuleAlertCounts();
  const { role } = useAuth();

  const fullNavigation = useMemo(() => {
    const all = [...navigation, ...adminNavigation];
    return all.filter((item) => item.allowedRoles.includes(role ?? ""));
  }, [role]);

  const toggleMenu = (path: string) => {
    setOpenMenus((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const isActive = (path: string) => location.pathname === path;
  const isParentActive = (item: SidebarItem) =>
    item.children?.some((c) => location.pathname.startsWith(c.path)) ||
    location.pathname === item.path;

  const renderBadge = (path: string) => {
    const count = alertCounts[path];
    if (!count || collapsed) return null;
    return (
      <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
        {count > 99 ? "99+" : count}
      </span>
    );
  };

  return (
    <aside
      className={`flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      } min-h-screen`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
          <span className="text-secondary-foreground font-bold text-sm">AG</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sidebar-accent-foreground font-bold text-sm leading-tight">AG Topografia</p>
            <p className="text-sidebar-muted text-xs">Sistema de Gestão</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {fullNavigation.map((item) => {
          const Icon = item.icon;
          const hasChildren = !!item.children?.length;
          const parentActive = isParentActive(item);
          const isOpen = openMenus.includes(item.path) || parentActive;

          return (
            <div key={item.path}>
              {hasChildren ? (
                <button
                  onClick={() => !collapsed && toggleMenu(item.path)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    parentActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {renderBadge(item.path)}
                      <ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    </>
                  )}
                </button>
              ) : (
                <NavLink
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              )}

              {/* Children */}
              {hasChildren && isOpen && !collapsed && (
                <div className="ml-5 pl-3 border-l border-sidebar-border space-y-0.5 mt-1">
                  {item.children!.map((child) => {
                    const ChildIcon = child.icon;
                    return (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive(child.path)
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        <ChildIcon className="w-4 h-4 shrink-0" />
                        <span>{child.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-12 border-t border-sidebar-border text-sidebar-muted hover:text-sidebar-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>
    </aside>
  );
}
