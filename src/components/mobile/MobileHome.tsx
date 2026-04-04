import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/hooks/useProjects";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  FolderOpen, Users, AlertTriangle, Receipt, ChevronRight,
  Radar, Briefcase, Map, PenTool, DollarSign, UserCheck,
  Car, AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

function formatDate() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

function fmtBRL(v: number) {
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1000) return `R$ ${Math.round(v / 1000)}K`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

const moduleCards = [
  { icon: Radar, label: "Radar", desc: "Visão panorâmica de tudo", path: "/", color: "#2D6A8E", bg: "#E8F4FD" },
  { icon: Map, label: "Campo", desc: "Escalas, veículos, despesas", path: "/operacional", color: "#8AB41D", bg: "#E8F5E9" },
  { icon: PenTool, label: "Prancheta", desc: "Sala Técnica — tarefas", path: "/sala-tecnica", color: "#E67E22", bg: "#FFF3E0" },
  { icon: DollarSign, label: "Faturamento", desc: "Medições, NFs, pipeline", path: "/financeiro", color: "#9B59B6", bg: "#F3E5F5" },
  { icon: Briefcase, label: "Negócios", desc: "Leads, propostas e clientes", path: "/comercial", color: "#2F9E8E", bg: "#E0F7FA" },
  { icon: UserCheck, label: "Pessoas", desc: "Funcionários, férias, ausências", path: "/rh", color: "#E74C3C", bg: "#FBE9E7" },
];

export default function MobileHome() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: projects = [] } = useProjects();

  const { data: alerts = [] } = useQuery({
    queryKey: ["mobile-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: todaySchedules = [] } = useQuery({
    queryKey: ["mobile-today-schedules"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("daily_team_assignments")
        .select(`
          id, team_id, project_id, notes,
          daily_schedule_id
        `)
        .in("daily_schedule_id", 
          (await supabase.from("daily_schedules").select("id").eq("schedule_date", today).eq("is_legacy", false)).data?.map(d => d.id) || []
        );
      if (error) throw error;
      return data;
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["mobile-teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id, name, leader_id").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const activeProjects = useMemo(() => projects.filter(p => p.execution_status !== "pago"), [projects]);
  const urgentAlerts = useMemo(() => alerts.filter((a: any) => a.priority === "urgente"), [alerts]);

  const aReceberValue = useMemo(() => {
    return projects
      .filter(p => p.execution_status === "entregue" || p.execution_status === "faturamento")
      .reduce((s, p) => s + (p.contract_value || 0), 0);
  }, [projects]);

  const teamMap = useMemo(() => {
    const m = new globalThis.Map<string, any>();
    teams.forEach(t => m.set(t.id, t));
    return m;
  }, [teams]);
  const projectMap = useMemo(() => {
    const m = new globalThis.Map<string, any>();
    projects.forEach(p => m.set(p.id, p));
    return m;
  }, [projects]);

  const teamColors = ["#8AB41D", "#2D6A8E", "#2F9E8E", "#E67E22", "#9B59B6", "#E74C3C"];

  const firstName = profile?.full_name?.split(" ")[0] || "Usuário";

  return (
    <div className="relative min-h-screen pb-20" style={{ background: "linear-gradient(180deg, #f8fafb 0%, #eef3f7 100%)" }}>
      {/* Topographic SVG background */}
      <svg className="fixed inset-0 w-full h-full pointer-events-none z-0" style={{ opacity: 0.05 }} viewBox="0 0 390 844" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="320" cy="200" rx="180" ry="120" fill="none" stroke="#2D6A8E" strokeWidth="1"/>
        <ellipse cx="320" cy="200" rx="150" ry="100" fill="none" stroke="#2D6A8E" strokeWidth="0.8"/>
        <ellipse cx="320" cy="200" rx="120" ry="80" fill="none" stroke="#2D6A8E" strokeWidth="0.8"/>
        <ellipse cx="320" cy="200" rx="90" ry="60" fill="none" stroke="#2D6A8E" strokeWidth="0.6"/>
        <ellipse cx="60" cy="500" rx="200" ry="140" fill="none" stroke="#8AB41D" strokeWidth="1"/>
        <ellipse cx="60" cy="500" rx="170" ry="115" fill="none" stroke="#8AB41D" strokeWidth="0.8"/>
        <ellipse cx="60" cy="500" rx="140" ry="90" fill="none" stroke="#8AB41D" strokeWidth="0.8"/>
        <ellipse cx="350" cy="700" rx="160" ry="110" fill="none" stroke="#2F9E8E" strokeWidth="0.8"/>
        <ellipse cx="350" cy="700" rx="130" ry="90" fill="none" stroke="#2F9E8E" strokeWidth="0.7"/>
        <ellipse cx="350" cy="700" rx="100" ry="70" fill="none" stroke="#2F9E8E" strokeWidth="0.6"/>
      </svg>

      <div className="relative z-[1]">
        {/* Header */}
        <div className="px-5 pt-5 pb-4" style={{ background: "linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--primary)) 60%, transparent 100%)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-white text-xl font-extrabold tracking-tight">AG<span className="text-[#8AB41D]">.</span></div>
              <div className="text-white/50 text-[9px] tracking-[2px] uppercase">Central Hub</div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/")} className="relative text-white">
                <AlertTriangle className="h-5 w-5" />
                {alerts.length > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-destructive text-white text-[10px] w-[18px] h-[18px] rounded-full flex items-center justify-center font-bold">
                    {alerts.length}
                  </span>
                )}
              </button>
            </div>
          </div>
          <p className="text-white/80 text-sm">{getGreeting()},</p>
          <p className="text-white text-lg font-semibold">{firstName} 👋</p>
        </div>

        {/* KPI Row */}
        <div className="flex gap-2.5 px-4 -mt-3 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { icon: FolderOpen, value: activeProjects.length, label: "Projetos ativos", color: "#2D6A8E" },
            { icon: Users, value: todaySchedules.length, label: "Equipes hoje", color: "#8AB41D" },
            { icon: AlertTriangle, value: alerts.length, label: "Alertas", color: "#E74C3C", alert: alerts.length > 0 },
            { icon: Receipt, value: fmtBRL(aReceberValue), label: "A receber", color: "#8AB41D", isMoney: true },
          ].map((kpi, i) => (
            <div
              key={i}
              className="bg-white rounded-[14px] p-3.5 min-w-[110px] flex-shrink-0 text-center"
              style={{
                boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                borderLeft: kpi.alert ? "4px solid #E74C3C" : undefined,
              }}
            >
              <div
                className={`font-extrabold ${kpi.isMoney ? "text-lg" : "text-[28px]"}`}
                style={{ color: kpi.color }}
              >
                {kpi.value}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wide">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Urgent alert banner */}
        {urgentAlerts.length > 0 && (
          <div className="mx-4 mt-3 rounded-xl p-3.5 flex items-center gap-3" style={{
            background: "rgba(255, 248, 225, 0.95)",
            borderLeft: "4px solid #FFC107",
          }}>
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">
                <strong>{(urgentAlerts[0] as any).title}</strong>
                {(urgentAlerts[0] as any).message && ` — ${(urgentAlerts[0] as any).message}`}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {formatDistanceToNow(new Date((urgentAlerts[0] as any).created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </div>
        )}

        {/* Today's Schedule Preview */}
        {todaySchedules.length > 0 && (
          <>
            <div className="px-4 pt-5 pb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Escala de hoje</h3>
              <button onClick={() => navigate("/operacional/escala")} className="text-xs text-[#2D6A8E] font-semibold">
                Ver completa →
              </button>
            </div>
            <div className="mx-4 rounded-2xl p-4" style={{
              background: "rgba(255, 255, 255, 0.92)",
              backdropFilter: "blur(10px)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}>
              <div className="flex justify-between items-center mb-3">
                <p className="text-base font-bold text-foreground">
                  {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                </p>
                <span className="text-[13px] text-[#2D6A8E] font-semibold">{todaySchedules.length} equipes ✓</span>
              </div>
              {todaySchedules.slice(0, 3).map((ts: any, i: number) => {
                const team = teamMap.get(ts.team_id);
                const project = projectMap.get(ts.project_id);
                return (
                  <div key={ts.id} className="flex items-center gap-3 py-2.5 border-t border-muted/50">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: teamColors[i % teamColors.length] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{team?.name || "Equipe"}</p>
                      <p className="text-xs text-muted-foreground truncate">{project ? `${project.codigo || ""} ${project.name}` : "—"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Module Cards */}
        <div className="px-4 pt-5 pb-2">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Módulos</h3>
        </div>
        <div className="px-4 space-y-3 pb-6">
          {moduleCards.map((m) => (
            <button
              key={m.path}
              onClick={() => navigate(m.path)}
              className="w-full flex items-center gap-4 p-5 rounded-2xl active:scale-[0.98] transition-transform"
              style={{
                background: "rgba(255, 255, 255, 0.92)",
                backdropFilter: "blur(10px)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              <div
                className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center shrink-0"
                style={{ background: m.bg }}
              >
                <m.icon className="h-6 w-6" style={{ color: m.color }} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[17px] font-bold text-foreground">{m.label}</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">{m.desc}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground/40" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
