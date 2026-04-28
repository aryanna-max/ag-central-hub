import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";

type IntegrationRow = Pick<
  Database["public"]["Tables"]["employee_client_integrations"]["Row"],
  "id" | "status" | "expiry_date"
> & {
  employees: { name: string | null; matricula: string | null } | null;
};

type ClientReqRow = Pick<
  Database["public"]["Tables"]["client_doc_requirements"]["Row"],
  "id" | "doc_type" | "is_mandatory" | "validity_months"
>;

interface ClientComplianceData {
  integrations: IntegrationRow[];
  requirements: ClientReqRow[];
}

function useClientCompliance(clientId: string) {
  return useQuery<ClientComplianceData>({
    queryKey: ["client-compliance", clientId],
    queryFn: async () => {
      const [integRes, reqRes] = await Promise.all([
        supabase
          .from("employee_client_integrations")
          .select("id, status, expiry_date, employees(name, matricula)")
          .eq("client_id", clientId)
          .order("expiry_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("client_doc_requirements")
          .select("id, doc_type, is_mandatory, validity_months")
          .eq("client_id", clientId),
      ]);
      if (integRes.error) throw integRes.error;
      if (reqRes.error) throw reqRes.error;
      return {
        integrations: (integRes.data ?? []) as unknown as IntegrationRow[],
        requirements: (reqRes.data ?? []) as ClientReqRow[],
      };
    },
    staleTime: 60_000,
  });
}

export default function ClientComplianceSection({ clientId }: { clientId: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useClientCompliance(clientId);

  if (isLoading) return <Skeleton className="h-20 w-full" />;
  if (!data) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const vencidos = data.integrations.filter((i) => {
    if (!i.expiry_date) return false;
    return differenceInCalendarDays(parseISO(i.expiry_date), today) < 0;
  });
  const vencendo30d = data.integrations.filter((i) => {
    if (!i.expiry_date) return false;
    const d = differenceInCalendarDays(parseISO(i.expiry_date), today);
    return d >= 0 && d <= 30;
  });

  const totalRequisitos = data.requirements.length;
  const obrigatorios = data.requirements.filter((r) => r.is_mandatory).length;

  const overallOk = vencidos.length === 0 && vencendo30d.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {overallOk ? (
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-amber-600" />
        )}
        <span className="text-sm font-medium">
          {overallOk ? "Sem pendências" : "Atenção em compliance"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded border p-2">
          <p className="text-muted-foreground">Requisitos cliente</p>
          <p className="font-bold text-base leading-tight">{totalRequisitos}</p>
          <p className="text-[10px] text-muted-foreground">{obrigatorios} obrigatórios</p>
        </div>
        <div className="rounded border p-2">
          <p className="text-muted-foreground">Integrações vencidas</p>
          <p className="font-bold text-base leading-tight">
            {vencidos.length > 0 ? (
              <span className="text-red-600">{vencidos.length}</span>
            ) : (
              "0"
            )}
          </p>
        </div>
        <div className="rounded border p-2">
          <p className="text-muted-foreground">Vencendo 30d</p>
          <p className="font-bold text-base leading-tight">
            {vencendo30d.length > 0 ? (
              <span className="text-amber-600">{vencendo30d.length}</span>
            ) : (
              "0"
            )}
          </p>
        </div>
      </div>

      {(vencidos.length > 0 || vencendo30d.length > 0) && (
        <div className="space-y-1">
          {vencidos.slice(0, 3).map((i) => (
            <div key={i.id} className="text-[11px] flex items-center gap-1.5">
              <Badge variant="destructive" className="text-[9px] h-4 px-1">vencida</Badge>
              <span className="truncate">
                {i.employees?.name ?? "—"}
                {i.employees?.matricula && ` (${i.employees.matricula})`}
              </span>
              {i.expiry_date && (
                <span className="text-muted-foreground">· {i.expiry_date}</span>
              )}
            </div>
          ))}
          {vencendo30d.slice(0, 2).map((i) => (
            <div key={i.id} className="text-[11px] flex items-center gap-1.5">
              <Badge className="bg-amber-100 text-amber-800 text-[9px] h-4 px-1">vencendo</Badge>
              <span className="truncate">
                {i.employees?.name ?? "—"}
                {i.employees?.matricula && ` (${i.employees.matricula})`}
              </span>
              {i.expiry_date && (
                <span className="text-muted-foreground">· {i.expiry_date}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="text-xs h-7 px-0"
        onClick={() => navigate(`/compliance/clientes`)}
      >
        Ver compliance do cliente <ArrowRight className="h-3 w-3 ml-1" />
      </Button>
    </div>
  );
}
