import { useState, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText, FolderKanban, Truck, Monitor,
  DollarSign, UserCog, ChevronLeft, ChevronRight, Target, UserCheck,
  Building2, CalendarDays, Car, FolderOpen, PackageCheck, Receipt,
  CreditCard, Wallet, UserPlus, FileCheck, HeartPulse, Banknote, Shield,
} from "lucide-react";
import { useModuleAlertCounts } from "@/hooks/useModuleAlertCounts";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarItem {
  label: string;
  path: string;
  icon: React.ElementType;
  children?: { label: string; path: string; icon: React.ElementType }[];
}

const navigation: SidebarItem[] = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  {
    label: "Comercial", path: "/comercial", icon: Users,
    children: [
      { label: "Leads", path: "/comercial/leads", icon: Target },
      { label: "Oportunidades", path: "/comercial/oportunidades", icon: UserCheck },
      { label: "Clientes", path: "/comercial/clientes", icon: Building2 },
    ],
  },
  { label: "Propostas", path: "/propostas", icon: FileText },
  {
    label: "Projetos", path: "/projetos", icon: FolderKanban,
    children: [
      { label: "Dashboard", path: "/projetos/dashboard", icon: LayoutDashboard },
      { label: "Kanban", path: "/projetos/kanban", icon: FolderKanban },
    ],
  },
  {
    label: "Operacional", path: "/operacional", icon: Truck,
    children: [
      { label: "Dashboard", path: "/operacional/dashboard", icon: LayoutDashboard },
      { label: "Equipes", path: "/operacional/equipes", icon: Users },
      { label: "Escala Diária", path: "/operacional/escala-diaria", icon: CalendarDays },
      { label: "Escala Mensal", path: "/operacional/escala", icon: CalendarDays },
      { label: "Medições", path: "/operacional/medicoes", icon: FileText },
      { label: "Despesas de Campo", path: "/operacional/despesas-de-campo", icon: Banknote },
      { label: "Veículos", path: "/operacional/veiculos", icon: Car },
    ],
  },
  {
    label: "Sala Técnica", path: "/sala-tecnica", icon: Monitor,
    children: [
      { label: "Arquivos", path: "/sala-tecnica/arquivos", icon: FolderOpen },
      { label: "Entregas", path: "/sala-tecnica/entregas", icon: PackageCheck },
    ],
  },
  {
    label: "Financeiro", path: "/financeiro", icon: DollarSign,
    children: [
      { label: "Dashboard", path: "/financeiro/dashboard", icon: LayoutDashboard },
      { label: "Faturamento", path: "/financeiro/faturamento", icon: Receipt },
      { label: "Pagamentos", path: "/financeiro/pagamentos", icon: CreditCard },
      { label: "Contas", path: "/financeiro/contas", icon: Wallet },
    ],
  },
  {
    label: "RH", path: "/rh", icon: UserCog,
    children: [
      { label: "Funcionários", path: "/rh/funcionarios", icon: UserPlus },
      { label: "Documentos", path: "/rh/documentos", icon: FileCheck },
      { label: "Exames", path: "/rh/exames", icon: HeartPulse },
    ],
  },
];

const adminNavigation: SidebarItem[] = [
  {
    label: "Administração", path: "/admin", icon: Shield,
    children: [
      { label: "Usuários", path: "/admin/usuarios", icon: UserPlus },
    ],
  },
];

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const location = useLocation();
  const alertCounts = useModuleAlertCounts();
  const { isMaster } = useAuth();
  
  const fullNavigation = useMemo(() => {
    return isMaster ? [...navigation, ...adminNavigation] : navigation;
  }, [isMaster]);

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
        {navigation.map((item) => {
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
