import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import { Search, LogOut } from "lucide-react";
import NotificationsPanel from "./NotificationsPanel";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export default function AppLayout() {
  const { profile, role, signOut } = useAuth();

  const roleLabel: Record<string, string> = {
    master: "Master",
    diretor: "Diretor",
    operacional: "Operacional",
    sala_tecnica: "Sala Técnica",
    comercial: "Comercial",
    financeiro: "Financeiro",
  };

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "AG";

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar no sistema..."
              className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-4">
            <NotificationsPanel />
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-foreground leading-tight">{profile?.full_name || "Usuário"}</p>
                <p className="text-xs text-muted-foreground">{role ? roleLabel[role] || role : ""}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-xs font-bold">{initials}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
