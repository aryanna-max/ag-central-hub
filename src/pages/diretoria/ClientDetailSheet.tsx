import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ArrowRight, Mail, Phone } from "lucide-react";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useClientContacts } from "@/hooks/useClients";
import type { Database } from "@/integrations/supabase/types";
import type { ClientCockpitRow } from "@/hooks/useClientCockpit";
import ClientInsightsSection from "./ClientInsightsSection";
import ClientComplianceSection from "./ClientComplianceSection";
import { cn } from "@/lib/utils";

type ProjectRow = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  | "id"
  | "codigo"
  | "name"
  | "execution_status"
  | "delivery_deadline"
  | "updated_at"
>;

type ActivityRow =
  | { kind: "project"; id: string; label: string; date: string | null }
  | { kind: "invoice"; id: string; label: string; date: string | null }
  | { kind: "interaction"; id: string; label: string; date: string | null };

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function useClientProjects(clientId: string | null) {
  return useQuery<ProjectRow[]>({
    queryKey: ["client-projects-active", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, codigo, name, execution_status, delivery_deadline, updated_at",
        )
        .eq("client_id", clientId!)
        .eq("is_active", true)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProjectRow[];
    },
    staleTime: 60_000,
  });
}

function useClientActivity(clientId: string | null) {
  return useQuery<ActivityRow[]>({
    queryKey: ["client-activity", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const [projRes, invRes, intRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, codigo, name, updated_at")
          .eq("client_id", clientId!)
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase
          .from("invoices")
          .select("id, nf_numero, valor_liquido, nf_data, status, projects!inner(client_id)")
          .eq("projects.client_id", clientId!)
          .order("nf_data", { ascending: false, nullsFirst: false })
          .limit(5),
        supabase
          .from("lead_interactions")
          .select("id, content, created_at, leads!inner(client_id)")
          .eq("leads.client_id", clientId!)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (projRes.error) throw projRes.error;
      if (invRes.error) throw invRes.error;
      if (intRes.error) throw intRes.error;

      const items: ActivityRow[] = [];
      for (const p of projRes.data ?? []) {
        items.push({
          kind: "project",
          id: p.id,
          label: `${p.codigo ?? ""} ${p.name}`.trim(),
          date: p.updated_at ?? null,
        });
      }
      for (const inv of (invRes.data ?? []) as Array<{
        id: string;
        nf_numero: string | null;
        valor_liquido: number | null;
        nf_data: string | null;
        status: string | null;
      }>) {
        items.push({
          kind: "invoice",
          id: inv.id,
          label: `NF ${inv.nf_numero ?? "—"} · ${
            inv.valor_liquido ? fmtBRL(Number(inv.valor_liquido)) : "—"
          } · ${inv.status ?? "—"}`,
          date: inv.nf_data ?? null,
        });
      }
      for (const int of (intRes.data ?? []) as Array<{
        id: string;
        content: string;
        created_at: string;
      }>) {
        items.push({
          kind: "interaction",
          id: int.id,
          label: int.content.slice(0, 80),
          date: int.created_at,
        });
      }

      items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
      return items.slice(0, 10);
    },
    staleTime: 60_000,
  });
}

interface BlockProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Block({ title, defaultOpen = true, children }: BlockProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-lg border">
      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 text-left">
        <span className="text-sm font-semibold">{title}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform data-[state=closed]:-rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 pt-0">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export interface ClientDetailSheetProps {
  row: ClientCockpitRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ClientDetailSheet({
  row,
  open,
  onOpenChange,
}: ClientDetailSheetProps) {
  const navigate = useNavigate();
  const clientId = row?.client.id ?? null;

  const { data: contacts = [] } = useClientContacts(clientId ?? undefined);
  const { data: projects = [], isLoading: projLoading } = useClientProjects(clientId);
  const { data: activity = [], isLoading: actLoading } = useClientActivity(clientId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto"
      >
        {row && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-block h-2.5 w-2.5 rounded-full",
                    row.semaforo === "vermelho" && "bg-red-500",
                    row.semaforo === "amarelo" && "bg-amber-500",
                    row.semaforo === "verde" && "bg-emerald-500",
                  )}
                />
                {row.client.name}
              </SheetTitle>
              <SheetDescription>
                {row.segmento ?? "Sem segmento"}
                {row.cnpjPrincipal && <> · {row.cnpjPrincipal}</>}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-3 mt-4">
              {/* 1) Identificação */}
              <Block title="Identificação">
                <div className="space-y-2 text-sm">
                  {row.comercialResponsavel && (
                    <div>
                      <span className="text-muted-foreground text-[11px]">
                        Comercial responsável
                      </span>
                      <p className="font-medium">{row.comercialResponsavel}</p>
                    </div>
                  )}

                  {contacts.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">
                      Nenhum contato cadastrado
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {contacts.slice(0, 4).map((c) => (
                        <div key={c.id} className="text-[11px] border-l-2 pl-2">
                          <p className="font-medium">{c.nome}</p>
                          <p className="text-muted-foreground">
                            {c.cargo ?? c.tipo ?? "—"}
                          </p>
                          <div className="flex flex-wrap gap-2 text-muted-foreground">
                            {c.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {c.email}
                              </span>
                            )}
                            {c.telefone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {c.telefone}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Block>

              {/* 2) KPIs */}
              <Block title="KPIs">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-[11px]">Projetos ativos</p>
                    <p className="font-bold text-lg">{row.kpis.projetosAtivos}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[11px]">A receber</p>
                    <p className="font-bold text-lg">
                      {row.kpis.aReceber > 0 ? fmtBRL(row.kpis.aReceber) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[11px]">Alertas</p>
                    <p className="font-bold text-lg">{row.kpis.alertas}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[11px]">Última atividade</p>
                    <p className="font-bold text-sm">
                      {row.kpis.ultimaAtividade
                        ? formatDistanceToNow(new Date(row.kpis.ultimaAtividade), {
                            addSuffix: true,
                            locale: ptBR,
                          })
                        : "—"}
                    </p>
                  </div>
                </div>
              </Block>

              {/* 3) Insights */}
              <Block title="Insights derivados" defaultOpen={false}>
                <ClientInsightsSection clientId={row.client.id} />
              </Block>

              {/* 4) Compliance */}
              <Block title="Compliance" defaultOpen={false}>
                <ClientComplianceSection clientId={row.client.id} />
              </Block>

              {/* 5) Projetos ativos */}
              <Block title={`Projetos ativos (${projects.length})`} defaultOpen={false}>
                {projLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : projects.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">
                    Nenhum projeto ativo
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-[11px]">
                    {projects.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-2 hover:bg-muted/50 rounded px-1.5 py-1 cursor-pointer"
                        onClick={() => navigate(`/projetos/${p.id}`)}
                      >
                        <span className="font-mono text-primary">
                          {p.codigo ?? "—"}
                        </span>
                        <span className="flex-1 truncate">{p.name}</span>
                        {p.execution_status && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1">
                            {p.execution_status}
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Block>

              {/* 6) Atividade recente */}
              <Block title="Atividade recente" defaultOpen={false}>
                {actLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : activity.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">
                    Sem atividade registrada
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-[11px]">
                    {activity.map((a) => (
                      <li key={`${a.kind}-${a.id}`} className="flex items-start gap-2">
                        <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                          {a.kind === "project"
                            ? "projeto"
                            : a.kind === "invoice"
                              ? "NF"
                              : "interação"}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{a.label}</p>
                          {a.date && (
                            <p className="text-muted-foreground">
                              {format(parseISO(a.date), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Block>

              <Button
                onClick={() => navigate(`/base/clientes/${row.client.id}`)}
                className="w-full"
              >
                Abrir histórico completo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
