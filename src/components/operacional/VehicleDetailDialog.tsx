import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Car, MapPin, User, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, subQuarters, eachMonthOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusColors: Record<string, string> = {
  disponivel: "bg-green-600 text-white",
  em_uso: "bg-blue-600 text-white",
  manutencao: "bg-amber-500 text-white",
  indisponivel: "bg-red-600 text-white",
};
const statusLabels: Record<string, string> = {
  disponivel: "Disponível",
  em_uso: "Em Uso",
  manutencao: "Manutenção",
  indisponivel: "Indisponível",
};

type PeriodFilter = "este_mes" | "mes_anterior" | "trimestre" | "personalizado";

function usePeriodRange(period: PeriodFilter, customStart: string, customEnd: string) {
  return useMemo(() => {
    const now = new Date();
    switch (period) {
      case "este_mes":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "mes_anterior": {
        const prev = subMonths(now, 1);
        return { start: startOfMonth(prev), end: endOfMonth(prev) };
      }
      case "trimestre":
        return { start: startOfMonth(subQuarters(now, 1)), end: endOfMonth(now) };
      case "personalizado":
        return {
          start: customStart ? new Date(customStart) : startOfMonth(now),
          end: customEnd ? new Date(customEnd) : endOfMonth(now),
        };
    }
  }, [period, customStart, customEnd]);
}

function useVehicleHistory(vehicleId: string | undefined, start: Date, end: Date) {
  return useQuery({
    queryKey: ["vehicle-history", vehicleId, start.toISOString(), end.toISOString()],
    enabled: !!vehicleId,
    queryFn: async () => {
      // Get daily_team_assignments for this vehicle in period
      const { data: assignments, error } = await supabase
        .from("daily_team_assignments")
        .select(`
          id,
          daily_schedule_id,
          obra_id,
          vehicle_id,
          notes,
          daily_schedules!inner(schedule_date),
          obras(name, location),
          teams(name)
        `)
        .eq("vehicle_id", vehicleId!)
        .gte("daily_schedules.schedule_date", format(start, "yyyy-MM-dd"))
        .lte("daily_schedules.schedule_date", format(end, "yyyy-MM-dd"))
        .order("daily_schedules(schedule_date)", { ascending: false });

      if (error) throw error;
      return (assignments || []) as any[];
    },
  });
}

interface VehicleDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: any;
}

export default function VehicleDetailDialog({ open, onOpenChange, vehicle }: VehicleDetailDialogProps) {
  const [period, setPeriod] = useState<PeriodFilter>("este_mes");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const range = usePeriodRange(period, customStart, customEnd);
  const { data: history, isLoading: historyLoading } = useVehicleHistory(
    open ? vehicle?.id : undefined,
    range.start,
    range.end
  );

  if (!vehicle) return null;

  const responsible = vehicle.responsible_employee;
  const dailyRate = Number(vehicle.daily_rate) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Car className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="text-lg">{vehicle.plate}</span>
              <span className="text-muted-foreground font-normal ml-2">
                {vehicle.brand} {vehicle.model} {vehicle.year && `(${vehicle.year})`}
              </span>
            </div>
            <Badge className={statusColors[vehicle.status] || ""}>
              {statusLabels[vehicle.status] || vehicle.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Summary info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {vehicle.color && (
            <div className="bg-muted/50 rounded-lg p-2.5">
              <span className="text-muted-foreground block text-xs">Cor</span>
              <span className="font-medium">{vehicle.color}</span>
            </div>
          )}
          {vehicle.owner_name && (
            <div className="bg-muted/50 rounded-lg p-2.5">
              <span className="text-muted-foreground block text-xs">Proprietário</span>
              <span className="font-medium">{vehicle.owner_name}</span>
            </div>
          )}
          {responsible && (
            <div className="bg-muted/50 rounded-lg p-2.5 flex items-start gap-1.5">
              <User className="w-3.5 h-3.5 mt-0.5 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground block text-xs">Responsável</span>
                <span className="font-medium">{responsible.name}</span>
              </div>
            </div>
          )}
          {vehicle.km_current != null && (
            <div className="bg-muted/50 rounded-lg p-2.5">
              <span className="text-muted-foreground block text-xs">Hodômetro</span>
              <span className="font-medium">{Number(vehicle.km_current).toLocaleString()} km</span>
            </div>
          )}
          {vehicle.home_address && (
            <div className="bg-muted/50 rounded-lg p-2.5 col-span-2 flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 mt-0.5 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground block text-xs">Endereço Base</span>
                <span className="font-medium">{vehicle.home_address}</span>
              </div>
            </div>
          )}
          {dailyRate > 0 && (
            <div className="bg-muted/50 rounded-lg p-2.5">
              <span className="text-muted-foreground block text-xs">Diária</span>
              <span className="font-medium">R$ {dailyRate.toFixed(2)}</span>
            </div>
          )}
        </div>

        <Tabs defaultValue="historico" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="historico" className="flex-1">Histórico</TabsTrigger>
            <TabsTrigger value="diarias" className="flex-1">Diárias</TabsTrigger>
            <TabsTrigger value="percurso" className="flex-1">Relatório de Percurso</TabsTrigger>
          </TabsList>

          <TabsContent value="historico" className="space-y-3">
            {/* Period filter */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="este_mes">Este mês</SelectItem>
                  <SelectItem value="mes_anterior">Mês anterior</SelectItem>
                  <SelectItem value="trimestre">Trimestre</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              {period === "personalizado" && (
                <>
                  <Input
                    type="date"
                    className="w-36"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                  <span className="text-muted-foreground text-sm">até</span>
                  <Input
                    type="date"
                    className="w-36"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </>
              )}
            </div>

            {/* History table */}
            {historyLoading ? (
              <p className="text-muted-foreground text-sm p-4">Carregando...</p>
            ) : !history?.length ? (
              <p className="text-muted-foreground text-sm text-center p-8">
                Nenhum registro no período selecionado.
              </p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Obra</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Equipe</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead className="text-right">Diária Calc.</TableHead>
                      <TableHead className="text-right">Diária Paga</TableHead>
                      <TableHead className="text-center">Diverg.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h: any) => {
                      const scheduleDate = h.daily_schedules?.schedule_date;
                      const obraName = h.obras?.name || "—";
                      const obraLocation = h.obras?.location || "—";
                      const teamName = h.teams?.name || "—";
                      const calculada = dailyRate;
                      const paga = dailyRate; // placeholder — will come from payment data
                      const divergent = Math.abs(calculada - paga) > 0.01;

                      return (
                        <TableRow key={h.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {scheduleDate
                              ? format(new Date(scheduleDate + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
                              : "—"}
                          </TableCell>
                          <TableCell>{obraName}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{obraLocation}</TableCell>
                          <TableCell>{teamName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">Escala</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            R$ {calculada.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            R$ {paga.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            {divergent && (
                              <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="font-semibold">
                      <TableCell colSpan={5} className="text-right">
                        Total ({history.length} {history.length === 1 ? "dia" : "dias"})
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        R$ {(history.length * dailyRate).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        R$ {(history.length * dailyRate).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {(() => {
                          const diff = (history.length * dailyRate) - (history.length * dailyRate);
                          return diff !== 0
                            ? <span className="text-destructive">R$ {diff.toFixed(2)}</span>
                            : <span className="text-muted-foreground">—</span>;
                        })()}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="diarias" className="min-h-[200px]">
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              Registro de diárias calculadas pelo fechamento de escalas.
            </div>
          </TabsContent>

          <TabsContent value="percurso" className="min-h-[200px]">
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              Relatório de percurso e quilometragem será exibido aqui.
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
