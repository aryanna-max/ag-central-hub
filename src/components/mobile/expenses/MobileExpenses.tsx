import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, Plus, ChevronRight, Copy, Send, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useExpenseSheets, useUpdateExpenseSheetStatus } from "@/hooks/useExpenseSheets";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  rascunho: { label: "Rascunho", color: "#6B7280", bg: "#F3F4F6" },
  submetido: { label: "Submetida", color: "#D97706", bg: "#FEF3C7" },
  aprovado: { label: "Aprovada", color: "#059669", bg: "#D1FAE5" },
  devolvido: { label: "Devolvida", color: "#DC2626", bg: "#FEE2E2" },
  pago: { label: "Paga", color: "#7C3AED", bg: "#EDE9FE" },
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function MobileExpenses() {
  const { data: sheets = [], isLoading } = useExpenseSheets();
  const updateStatus = useUpdateExpenseSheetStatus();

  const kpis = useMemo(() => {
    const total = sheets.reduce((s, sh) => s + (sh.total_value || 0), 0);
    const pending = sheets.filter(s => s.status === "submetido").length;
    const approved = sheets.filter(s => s.status === "aprovado").length;
    return { total, pending, approved };
  }, [sheets]);

  const handleSubmit = async (id: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: "submetido" });
      toast.success("Folha submetida!");
    } catch {
      toast.error("Erro ao submeter");
    }
  };

  const handleCopyLink = (sheet: any) => {
    const token = sheet.approval_token;
    if (!token) {
      toast.error("Token de aprovação não disponível");
      return;
    }
    const url = `${window.location.origin}/aprovacao/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-primary">Despesas de Campo</h1>
        </div>
      </div>

      {/* KPIs */}
      <div className="flex gap-2.5 px-4 pb-3 overflow-x-auto scrollbar-hide">
        {[
          { label: "Total", value: fmtBRL(kpis.total), color: "#2D6A8E" },
          { label: "Pendentes", value: String(kpis.pending), color: "#D97706" },
          { label: "Aprovadas", value: String(kpis.approved), color: "#059669" },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-xl p-3 min-w-[100px] flex-shrink-0 text-center" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div className="font-extrabold text-lg" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && sheets.length === 0 && (
        <div className="text-center py-12 px-4">
          <DollarSign className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma folha de despesa</p>
        </div>
      )}

      {/* Cards */}
      <div className="px-4 space-y-3">
        {sheets.map(sheet => {
          const cfg = statusConfig[sheet.status] || statusConfig.rascunho;
          return (
            <div
              key={sheet.id}
              className="bg-white rounded-2xl p-4"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">
                    {sheet.week_label || `Semana ${sheet.week_number}`}
                  </span>
                </div>
                <Badge style={{ background: cfg.bg, color: cfg.color }} className="text-[10px] font-semibold border-0">
                  {cfg.label}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span>
                  {format(new Date(sheet.period_start + "T12:00:00"), "dd/MM", { locale: ptBR })} — {format(new Date(sheet.period_end + "T12:00:00"), "dd/MM/yy", { locale: ptBR })}
                </span>
                <span className="font-bold text-sm text-foreground">
                  {fmtBRL(sheet.total_value || 0)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {sheet.status === "rascunho" && (
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5 h-9" onClick={() => handleSubmit(sheet.id)}>
                    <Send className="w-3.5 h-3.5" /> Submeter
                  </Button>
                )}
                {(sheet.status === "submetido" || sheet.status === "aprovado") && sheet.approval_token && (
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5 h-9" onClick={() => handleCopyLink(sheet)}>
                    <Copy className="w-3.5 h-3.5" /> Copiar Link
                  </Button>
                )}
              </div>

              {sheet.return_comment && (
                <div className="mt-2 p-2 rounded-lg text-xs bg-destructive/10 text-destructive">
                  <strong>Devolvida:</strong> {sheet.return_comment}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
