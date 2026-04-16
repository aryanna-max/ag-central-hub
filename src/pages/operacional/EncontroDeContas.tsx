import { useState, useMemo } from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, Save, Lock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useBenefitSettlements,
  useGenerateBenefitSettlements,
  useUpdateBenefitSettlement,
  useCloseWeekSettlements,
  useMarkSettlementsDescontado,
} from "@/hooks/useBenefitSettlements";

function parsedAvgs(notes: string | null): { avgCafe: number; avgAlmoco: number; avgJantar: number } {
  if (!notes) return { avgCafe: 0, avgAlmoco: 0, avgJantar: 0 };
  try {
    const parsed = JSON.parse(notes);
    return {
      avgCafe: parsed.avgCafe ?? 0,
      avgAlmoco: parsed.avgAlmoco ?? 0,
      avgJantar: parsed.avgJantar ?? 0,
    };
  } catch {
    return { avgCafe: 0, avgAlmoco: 0, avgJantar: 0 };
  }
}

function fmt(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getMostRecentMonday(): string {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  return format(monday, "yyyy-MM-dd");
}

type RowEdits = {
  cafe_realizado: number;
  almoco_realizado: number;
  jantar_realizado: number;
};

type StatusBadgeVariant = "outline" | "secondary" | "default" | "destructive";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    aberto: { label: "Aberto", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    fechado: { label: "Fechado", className: "bg-blue-100 text-blue-800 border-blue-300" },
    descontado: { label: "Descontado", className: "bg-green-100 text-green-800 border-green-300" },
  };
  const info = map[status] ?? { label: status, className: "" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${info.className}`}>
      {info.label}
    </span>
  );
}

export default function EncontroDeContas() {
  const { toast } = useToast();

  const [semanaInicio, setSemanaInicio] = useState(getMostRecentMonday);
  const semanaFim = useMemo(
    () => format(addDays(new Date(semanaInicio + "T12:00:00"), 6), "yyyy-MM-dd"),
    [semanaInicio]
  );

  const { data: settlements = [], isLoading } = useBenefitSettlements({ semana_inicio: semanaInicio });
  const generateMutation = useGenerateBenefitSettlements();
  const updateMutation = useUpdateBenefitSettlement();
  const closeMutation = useCloseWeekSettlements();
  const descontadoMutation = useMarkSettlementsDescontado();

  // Local edits per row id
  const [edits, setEdits] = useState<Record<string, RowEdits>>({});

  const getEdits = (row: any): RowEdits =>
    edits[row.id] ?? {
      cafe_realizado: row.cafe_realizado,
      almoco_realizado: row.almoco_realizado,
      jantar_realizado: row.jantar_realizado,
    };

  const setEdit = (id: string, field: keyof RowEdits, value: number) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...getEdits({ id, cafe_realizado: 0, almoco_realizado: 0, jantar_realizado: 0, ...prev[id] }), [field]: value },
    }));
  };

  const handleGenerate = async () => {
    try {
      const result = await generateMutation.mutateAsync({ semana_inicio: semanaInicio, semana_fim: semanaFim });
      toast({
        title: "Encontro gerado",
        description: `${result.count} registros criados/atualizados.`,
      });
      setEdits({});
    } catch (err: any) {
      toast({ title: "Erro ao gerar", description: err.message, variant: "destructive" });
    }
  };

  const handleSaveRow = async (row: any) => {
    const rowEdits = getEdits(row);
    const avgs = parsedAvgs(row.notes);
    try {
      await updateMutation.mutateAsync({
        id: row.id,
        cafe_realizado: rowEdits.cafe_realizado,
        almoco_realizado: rowEdits.almoco_realizado,
        jantar_realizado: rowEdits.jantar_realizado,
        notes: row.notes,
        avgCafe: avgs.avgCafe,
        avgAlmoco: avgs.avgAlmoco,
        avgJantar: avgs.avgJantar,
        cafe_previsto: row.cafe_previsto,
        almoco_previsto: row.almoco_previsto,
        jantar_previsto: row.jantar_previsto,
      });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      toast({ title: "Salvo", description: "Registro atualizado." });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  };

  const handleCloseWeek = async () => {
    try {
      await closeMutation.mutateAsync(semanaInicio);
      toast({ title: "Semana fechada", description: "Todos os registros foram bloqueados." });
    } catch (err: any) {
      toast({ title: "Erro ao fechar semana", description: err.message, variant: "destructive" });
    }
  };

  const handleMarcarDescontado = async () => {
    try {
      await descontadoMutation.mutateAsync(semanaInicio);
      toast({ title: "Marcado como descontado", description: "Descontos aplicados à folha." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const hasAbertos = settlements.some((s: any) => s.status === "aberto");
  const allFechados = settlements.length > 0 && settlements.every((s: any) => s.status === "fechado");
  const totalSaldo = settlements.reduce((acc: number, s: any) => acc + (s.saldo_desconto ?? 0), 0);

  const semanaLabel = useMemo(() => {
    const ini = new Date(semanaInicio + "T12:00:00");
    const fim = new Date(semanaFim + "T12:00:00");
    return `${format(ini, "dd/MM", { locale: ptBR })} a ${format(fim, "dd/MM/yyyy", { locale: ptBR })}`;
  }, [semanaInicio, semanaFim]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Encontro de Contas</h1>
          <p className="text-muted-foreground text-sm">Adiantamentos semanais de benefícios vs. realizado</p>
        </div>
      </div>

      {/* Week selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label htmlFor="semana-inicio" className="text-sm mb-1 block">Semana de</Label>
              <Input
                id="semana-inicio"
                type="date"
                value={semanaInicio}
                onChange={(e) => {
                  setSemanaInicio(e.target.value);
                  setEdits({});
                }}
                className="w-44"
              />
            </div>
            <div>
              <Label className="text-sm mb-1 block">até</Label>
              <Input type="date" value={semanaFim} disabled className="w-44 bg-muted" />
            </div>
            <div className="text-sm text-muted-foreground pt-1">
              {semanaLabel}
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="ml-auto"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${generateMutation.isPending ? "animate-spin" : ""}`} />
              Gerar / Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : settlements.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground mb-4">Nenhum registro encontrado para esta semana.</p>
            <Button onClick={handleGenerate} disabled={generateMutation.isPending} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${generateMutation.isPending ? "animate-spin" : ""}`} />
              Gerar Encontro de Contas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Registros da semana {semanaLabel}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Funcionário</th>
                    <th className="text-center px-3 py-3 font-medium text-muted-foreground">Café Prev.</th>
                    <th className="text-center px-3 py-3 font-medium text-muted-foreground">Café Real.</th>
                    <th className="text-center px-3 py-3 font-medium text-muted-foreground">Alm.Dif. Prev.</th>
                    <th className="text-center px-3 py-3 font-medium text-muted-foreground">Alm.Dif. Real.</th>
                    <th className="text-center px-3 py-3 font-medium text-muted-foreground">Jantar Prev.</th>
                    <th className="text-center px-3 py-3 font-medium text-muted-foreground">Jantar Real.</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Saldo Desc.</th>
                    <th className="text-center px-3 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {(settlements as any[]).map((row) => {
                    const rowEdits = getEdits(row);
                    const avgs = parsedAvgs(row.notes);
                    const isLocked = row.status !== "aberto";
                    const isDirty = JSON.stringify(rowEdits) !== JSON.stringify({
                      cafe_realizado: row.cafe_realizado,
                      almoco_realizado: row.almoco_realizado,
                      jantar_realizado: row.jantar_realizado,
                    });

                    // Compute preview saldo
                    const previewSaldo = Math.max(
                      0,
                      (row.cafe_previsto - rowEdits.cafe_realizado) * avgs.avgCafe +
                      (row.almoco_previsto - rowEdits.almoco_realizado) * avgs.avgAlmoco +
                      (row.jantar_previsto - rowEdits.jantar_realizado) * avgs.avgJantar
                    );

                    const empName = (row as any).employees?.name ?? "—";
                    const empMatricula = (row as any).employees?.matricula ?? "";

                    return (
                      <tr key={row.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium">{empName}</div>
                          {empMatricula && <div className="text-xs text-muted-foreground">{empMatricula}</div>}
                        </td>
                        {/* Café previsto */}
                        <td className="text-center px-3 py-3 text-muted-foreground">{row.cafe_previsto}</td>
                        {/* Café realizado */}
                        <td className="text-center px-3 py-2">
                          <Input
                            type="number"
                            min={0}
                            max={row.cafe_previsto}
                            value={rowEdits.cafe_realizado}
                            disabled={isLocked}
                            onChange={(e) => setEdit(row.id, "cafe_realizado", Math.min(row.cafe_previsto, Math.max(0, parseInt(e.target.value) || 0)))}
                            className="w-16 text-center h-8 mx-auto disabled:bg-muted"
                          />
                        </td>
                        {/* Almoço dif previsto */}
                        <td className="text-center px-3 py-3 text-muted-foreground">{row.almoco_previsto}</td>
                        {/* Almoço dif realizado */}
                        <td className="text-center px-3 py-2">
                          <Input
                            type="number"
                            min={0}
                            max={row.almoco_previsto}
                            value={rowEdits.almoco_realizado}
                            disabled={isLocked}
                            onChange={(e) => setEdit(row.id, "almoco_realizado", Math.min(row.almoco_previsto, Math.max(0, parseInt(e.target.value) || 0)))}
                            className="w-16 text-center h-8 mx-auto disabled:bg-muted"
                          />
                        </td>
                        {/* Jantar previsto */}
                        <td className="text-center px-3 py-3 text-muted-foreground">{row.jantar_previsto}</td>
                        {/* Jantar realizado */}
                        <td className="text-center px-3 py-2">
                          <Input
                            type="number"
                            min={0}
                            max={row.jantar_previsto}
                            value={rowEdits.jantar_realizado}
                            disabled={isLocked}
                            onChange={(e) => setEdit(row.id, "jantar_realizado", Math.min(row.jantar_previsto, Math.max(0, parseInt(e.target.value) || 0)))}
                            className="w-16 text-center h-8 mx-auto disabled:bg-muted"
                          />
                        </td>
                        {/* Saldo */}
                        <td className={`text-right px-4 py-3 font-medium ${isDirty ? "text-orange-600" : previewSaldo > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                          {fmt(isDirty ? previewSaldo : (row.saldo_desconto ?? 0))}
                          {isDirty && <span className="text-xs ml-1">(prévia)</span>}
                        </td>
                        {/* Status */}
                        <td className="text-center px-3 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                        {/* Actions */}
                        <td className="px-3 py-2 text-center">
                          {!isLocked && (
                            <Button
                              size="icon"
                              variant={isDirty ? "default" : "ghost"}
                              className="h-8 w-8"
                              onClick={() => handleSaveRow(row)}
                              disabled={updateMutation.isPending}
                              title="Salvar alterações"
                            >
                              <Save className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer summary + actions */}
      {settlements.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Total a descontar da semana: </span>
            <span className={`font-bold text-base ${totalSaldo > 0 ? "text-red-600" : "text-green-600"}`}>
              {fmt(totalSaldo)}
            </span>
            <span className="ml-3 text-muted-foreground">({settlements.length} funcionários)</span>
          </div>

          <div className="flex gap-2">
            {hasAbertos && (
              <Button
                variant="outline"
                onClick={handleCloseWeek}
                disabled={closeMutation.isPending}
                className="gap-2"
              >
                <Lock className="w-4 h-4" />
                Fechar Semana
              </Button>
            )}
            {allFechados && (
              <Button
                onClick={handleMarcarDescontado}
                disabled={descontadoMutation.isPending}
                className="gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Marcar Descontado
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
