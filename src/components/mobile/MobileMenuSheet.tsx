import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Radar, Briefcase, Map, PenTool, Receipt, Users, Database,
  ChevronRight, LogOut, FolderKanban,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const modules = [
  { icon: Radar, label: "Radar", desc: "Visão panorâmica", path: "/", color: "#2D6A8E" },
  { icon: Briefcase, label: "Negócios", desc: "Leads, propostas e clientes", path: "/comercial", color: "#2F9E8E" },
  { icon: Map, label: "Campo", desc: "Escalas, veículos, despesas", path: "/operacional/escala", color: "#8AB41D" },
  { icon: PenTool, label: "Prancheta", desc: "Sala Técnica — tarefas", path: "/sala-tecnica", color: "#E67E22" },
  { icon: Receipt, label: "Faturamento", desc: "Medições, NFs, pipeline", path: "/financeiro", color: "#9B59B6" },
  { icon: Users, label: "Pessoas", desc: "Funcionários, férias", path: "/rh", color: "#E74C3C" },
  { icon: FolderKanban, label: "Projetos", desc: "Kanban e dashboard", path: "/projetos/kanban", color: "#3498DB" },
  { icon: Database, label: "Base", desc: "Cadastros e configurações", path: "/admin/cadastros", color: "#636569" },
];

export default function MobileMenuSheet({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "AG";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[300px] p-0">
        <SheetHeader className="p-5 pb-4 border-b border-border">
          <SheetTitle className="sr-only">Menu mobile</SheetTitle>
          <SheetDescription className="sr-only">Acesso rápido aos módulos e ações do usuário.</SheetDescription>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-bold">{initials}</span>
            </div>
            <div>
              <p className="text-base font-semibold text-left">{profile?.full_name || "Usuário"}</p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="py-2 flex-1 overflow-y-auto">
          {modules.map((m) => (
            <button
              key={m.path}
              onClick={() => { navigate(m.path); onOpenChange(false); }}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${m.color}15` }}
              >
                <m.icon className="h-4.5 w-4.5" style={{ color: m.color }} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        <div className="border-t border-border p-4">
          <Button variant="ghost" className="w-full justify-start gap-2 text-destructive" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
