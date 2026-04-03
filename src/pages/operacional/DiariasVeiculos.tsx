import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Car, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableFooter } from "@/components/ui/table";
import { toast } from "sonner";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const WEEKDAYS_PT = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function fmt(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function useSystemSetting(key: string) {
  return useQuery({
    queryKey: ["system-settings", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return data?.value || "0";
    },
  });
}

function useVehicleDailyEntries(month: number, year: number) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

  return useQuery({
    queryKey: ["vehicle-daily-entries", month, year],
    queryFn: async () => {
      // Get all daily_schedule_entries with vehicle_id in the period
      const { data: schedules, error: sErr } = await supabase
        .from("daily_schedules")
        .select("id, schedule_date")
        .gte("schedule_date", startDate)
        .lte("schedule_date", endDate);
      if (sErr) throw sErr;
      if (!schedules?.length) return [];

      const scheduleIds = schedules.map((s) => s.id);
      const dateMap: Record<string, string> = {};
      schedules.forEach((s) => { dateMap[s.id] = s.schedule_date; });

      const { data: entries, error: eErr } = await supabase
        .from("daily_schedule_entries")
        .select("vehicle_id, daily_schedule_id, project_id")
        .in("daily_schedule_id", scheduleIds)
        .not("vehicle_id", "is", null);
      if (eErr) throw eErr;

      // Deduplicate: same vehicle + same date = 1 day
      const seen = new Set<string>();
      const result: { vehicle_id: string; date: string; project_id: string | null }[] = [];
      (entries || []).forEach((e) => {
        const date = dateMap[e.daily_schedule_id];
        const key = `${e.vehicle_id}_${date}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ vehicle_id: e.vehicle_id!, date, project_id: e.project_id });
        }
      });

      return result;
    },
  });
}

function useVehicles() {
  return useQuery({
    queryKey: ["vehicles-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*, responsible_employee:responsible_employee_id(id, name)")
        .order("plate");
      if (error) throw error;
      return data;
    },
  });
}

function useProjects() {
  return useQuery({
    queryKey: ["projects-all-names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name").eq("is_active", true).eq("show_in_operational", true).in("execution_status", ["aguardando_campo", "em_campo"] as any);
      if (error) throw error;
      return data;
    },
  });
}

function usePaymentHistory(month: number, year: number) {
  return useQuery({
    queryKey: ["vehicle-payment-history", month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_payment_history")
        .select("*")
        .eq("month", month)
        .eq("year", year);
      if (error) throw error;
      return data || [];
    },
  });
}

export default function DiariasVeiculos() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dailyRate, setDailyRate] = useState("");
  const [detailVehicleId, setDetailVehicleId] = useState("");
  const [detailMonth, setDetailMonth] = useState(now.getMonth() + 1);
  const [detailYear, setDetailYear] = useState(now.getFullYear());

  const qc = useQueryClient();
  const { data: settingRate } = useSystemSetting("vehicle_daily_rate");
  const { data: entries } = useVehicleDailyEntries(month, year);
  const { data: vehicles } = useVehicles();
  const { data: projects } = useProjects();
  const { data: history } = usePaymentHistory(month, year);
  const { data: detailEntries } = useVehicleDailyEntries(detailMonth, detailYear);

  const rate = Number(dailyRate || settingRate || 0);

  const projectMap = useMemo(() => {
    const m: Record<string, string> = {};
    (projects || []).forEach((p) => { m[p.id] = p.name; });
    return m;
  }, [projects]);

  const vehicleMap = useMemo(() => {
    const m: Record<string, any> = {};
    (vehicles || []).forEach((v) => { m[v.id] = v; });
    return m;
  }, [vehicles]);

  const isClosed = (history || []).length > 0;

  // Aggregate: { vehicle_id -> { days, projectIds } }
  const summary = useMemo(() => {
    const agg: Record<string, { days: number; projectIds: Set<string> }> = {};
    (entries || []).forEach((e) => {
      if (!agg[e.vehicle_id]) agg[e.vehicle_id] = { days: 0, projectIds: new Set() };
      agg[e.vehicle_id].days++;
      if (e.project_id) agg[e.vehicle_id].projectIds.add(e.project_id);
    });
    return agg;
  }, [entries]);

  const summaryRows = useMemo(() => {
    return Object.entries(summary)
      .map(([vid, data]) => {
        const v = vehicleMap[vid];
        if (!v) return null;
        return {
          id: vid,
          model: v.model,
          plate: v.plate,
          responsible: v.is_rented ? "Locadora" : (v.responsible_employee as any)?.name || "—",
          isRented: v.is_rented,
          projects: Array.from(data.projectIds).map((pid) => projectMap[pid] || "—").join(", "),
          days: data.days,
          rate: v.is_rented ? 0 : rate,
          total: v.is_rented ? 0 : data.days * rate,
        };
      })
      .filter(Boolean) as any[];
  }, [summary, vehicleMap, projectMap, rate]);

  const totalDays = summaryRows.reduce((s, r) => s + r.days, 0);
  const totalValue = summaryRows.reduce((s, r) => s + r.total, 0);

  const handleSaveRate = async () => {
    try {
      await supabase
        .from("system_settings")
        .upsert({ key: "vehicle_daily_rate", value: String(rate) } as any);
      qc.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("Valor da diária salvo!");
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  const handleCloseMonth = async () => {
    if (!confirm(`Fechar diárias de ${MONTHS[month - 1]}/${year}? Os valores serão congelados.`)) return;
    try {
      for (const row of summaryRows) {
        if (row.isRented) continue;
        const v = vehicleMap[row.id];
        await supabase.from("vehicle_payment_history").insert({
          vehicle_id: row.id,
          employee_id: v?.responsible_employee_id || null,
          month,
          year,
          days_count: row.days,
          daily_rate: rate,
          total_value: row.total,
        } as any);
      }
      qc.invalidateQueries({ queryKey: ["vehicle-payment-history"] });
      toast.success("Mês fechado com sucesso!");
    } catch {
      toast.error("Erro ao fechar mês");
    }
  };

  // Detail tab
  const detailVehicle = vehicleMap[detailVehicleId];
  const detailDays = useMemo(() => {
    if (!detailVehicleId) return [];
    return (detailEntries || [])
      .filter((e) => e.vehicle_id === detailVehicleId)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => {
        const d = new Date(e.date + "T12:00:00");
        return {
          date: d.toLocaleDateString("pt-BR"),
          weekday: WEEKDAYS_PT[d.getDay()],
          project: e.project_id ? projectMap[e.project_id] || "—" : "—",
        };
      });
  }, [detailEntries, detailVehicleId, projectMap]);

  const detailProjects = useMemo(() => {
    const s = new Set<string>();
    detailDays.forEach((d) => { if (d.project !== "—") s.add(d.project); });
    return Array.from(s).join(", ") || "—";
  }, [detailDays]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Car className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Diárias de Veículos</h1>
          <p className="text-sm text-muted-foreground">Controle de diárias pagas aos motoristas</p>
        </div>
      </div>

      <Tabs defaultValue="fechamento">
        <TabsList>
          <TabsTrigger value="fechamento">Fechamento Mensal</TabsTrigger>
          <TabsTrigger value="detalhe">Detalhe por Veículo</TabsTrigger>
        </TabsList>

        {/* ═══ ABA 1: Fechamento Mensal ═══ */}
        <TabsContent value="fechamento">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">Valor da diária (R$):</Label>
                  <Input
                    type="number"
                    value={dailyRate || settingRate || ""}
                    onChange={(e) => setDailyRate(e.target.value)}
                    className="w-28"
                    disabled={isClosed}
                  />
                  {!isClosed && (
                    <Button size="sm" variant="outline" onClick={handleSaveRate}>Salvar</Button>
                  )}
                </div>
                {isClosed && (
                  <Badge className="bg-emerald-600 text-white gap-1 ml-auto">
                    <Lock className="w-3 h-3" /> Fechado em {new Date((history as any)?.[0]?.closed_at).toLocaleDateString("pt-BR")}
                  </Badge>
                )}
                {!isClosed && summaryRows.length > 0 && (
                  <Button onClick={handleCloseMonth} className="gap-2 ml-auto">
                    <Lock className="w-4 h-4" /> Fechar Mês
                  </Button>
                )}
              </div>

              {summaryRows.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum veículo rodou neste período.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Projetos do mês</TableHead>
                      <TableHead className="text-center">Dias</TableHead>
                      <TableHead className="text-right">Valor diária</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.model}</TableCell>
                        <TableCell className="font-mono">{row.plate}</TableCell>
                        <TableCell>
                          {row.isRented ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-500">Locadora</Badge>
                          ) : row.responsible}
                        </TableCell>
                        <TableCell className="text-sm max-w-52 truncate">{row.projects}</TableCell>
                        <TableCell className="text-center font-semibold">{row.days}</TableCell>
                        <TableCell className="text-right">{row.isRented ? "—" : fmt(row.rate)}</TableCell>
                        <TableCell className="text-right font-semibold">{row.isRented ? "—" : fmt(row.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="font-bold">TOTAL</TableCell>
                      <TableCell className="text-center font-bold">{totalDays}</TableCell>
                      <TableCell />
                      <TableCell className="text-right font-bold">{fmt(totalValue)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ ABA 2: Detalhe por Veículo ═══ */}
        <TabsContent value="detalhe">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={detailVehicleId} onValueChange={setDetailVehicleId}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Selecionar veículo..." /></SelectTrigger>
                  <SelectContent>
                    {(vehicles || []).map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.model} — {v.plate}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(detailMonth)} onValueChange={(v) => setDetailMonth(Number(v))}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(detailYear)} onValueChange={(v) => setDetailYear(Number(v))}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {detailVehicle && detailDays.length > 0 && (
                <>
                  <div className="rounded-lg border bg-muted/30 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Veículo:</span><p className="font-medium">{detailVehicle.model}</p></div>
                    <div><span className="text-muted-foreground">Placa:</span><p className="font-mono font-medium">{detailVehicle.plate}</p></div>
                    <div>
                      <span className="text-muted-foreground">Responsável:</span>
                      <p className="font-medium">{detailVehicle.is_rented ? "Locadora" : (detailVehicle.responsible_employee as any)?.name || "—"}</p>
                    </div>
                    <div><span className="text-muted-foreground">Total dias:</span><p className="font-bold text-lg">{detailDays.length}</p></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Projetos:</span><p>{detailProjects}</p></div>
                    {!detailVehicle.is_rented && (
                      <div className="col-span-2"><span className="text-muted-foreground">Total a receber:</span><p className="font-bold text-primary text-lg">{fmt(detailDays.length * rate)}</p></div>
                    )}
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Dia da semana</TableHead>
                        <TableHead>Projeto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailDays.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono">{d.date}</TableCell>
                          <TableCell>{d.weekday}</TableCell>
                          <TableCell>{d.project}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}

              {detailVehicleId && detailDays.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Nenhum registro para este veículo no período.</p>
              )}

              {!detailVehicleId && (
                <p className="text-center text-muted-foreground py-8">Selecione um veículo para ver o detalhe.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
