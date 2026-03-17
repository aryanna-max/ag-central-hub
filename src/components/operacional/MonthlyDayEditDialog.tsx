import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Car } from "lucide-react";
import { useTeams } from "@/hooks/useTeams";
import { useVehicles } from "@/hooks/useVehicles";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: {
    id: string;
    team_id: string;
    obra_id: string;
    vehicle_id?: string | null;
    start_date: string;
    end_date: string;
    teams: { id: string; name: string; team_members?: any[] } | null;
    obras: { id: string; name: string; client: string | null } | null;
    vehicles?: { id: string; model: string; plate: string } | null;
  } | null;
  day: number;
  month: number;
  year: number;
  onSave: (scheduleId: string, updates: { team_id?: string; obra_id?: string; vehicle_id?: string }) => void;
  isPending: boolean;
}

export default function MonthlyDayEditDialog({
  open,
  onOpenChange,
  schedule,
  day,
  month,
  year,
  onSave,
  isPending,
}: Props) {
  const [teamId, setTeamId] = useState("");
  const [obraId, setObraId] = useState("");
  const [vehicleId, setVehicleId] = useState("");

  const { data: teams } = useTeams();
  const { data: vehicles } = useVehicles();
  const { data: obras } = useQuery({
    queryKey: ["obras"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (schedule) {
      setTeamId(schedule.team_id);
      setObraId(schedule.obra_id);
      setVehicleId(schedule.vehicle_id || "");
    }
  }, [schedule]);

  if (!schedule) return null;

  const dateStr = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  const selectedTeam = (teams || []).find((t: any) => t.id === teamId);
  const topografo = (selectedTeam as any)?.team_members?.find((m: any) => m.role === "topografo");
  const auxiliares = (selectedTeam as any)?.team_members?.filter((m: any) => m.role !== "topografo") || [];

  const todayStr = new Date().toISOString().slice(0, 10);
  const targetDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const isPast = targetDate < todayStr;

  const hasChanges = teamId !== schedule.team_id || obraId !== schedule.obra_id || vehicleId !== (schedule.vehicle_id || "");

  const handleSave = () => {
    const updates: { team_id?: string; obra_id?: string; vehicle_id?: string } = {};
    if (teamId !== schedule.team_id) updates.team_id = teamId;
    if (obraId !== schedule.obra_id) updates.obra_id = obraId;
    if (vehicleId !== (schedule.vehicle_id || "")) updates.vehicle_id = vehicleId;
    onSave(schedule.id, updates);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            Editar Alocação — {dateStr}
          </DialogTitle>
        </DialogHeader>

        {isPast && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-md">
            <AlertTriangle className="w-4 h-4" />
            <span>Escalas diárias já confirmadas não serão alteradas.</span>
          </div>
        )}

        <div className="space-y-4">
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
            <p>
              Período: <span className="font-medium text-foreground">{schedule.start_date} → {schedule.end_date}</span>
            </p>
            <p className="mt-0.5">A alteração afeta todo o período nos dias ainda não fechados.</p>
          </div>

          {/* Equipe */}
          <div>
            <label className="text-sm font-medium mb-1 block">Equipe</label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger><SelectValue placeholder="Selecionar equipe..." /></SelectTrigger>
              <SelectContent>
                {(teams || []).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Team composition preview */}
          {selectedTeam && (
            <div className="border border-border rounded-md p-2 space-y-1">
              <p className="text-xs text-muted-foreground">Composição da equipe:</p>
              <p className="text-sm">
                <span className="font-bold">Topógrafo:</span>{" "}
                {topografo?.employees?.name || "—"}
              </p>
              {auxiliares.length > 0 && (
                <p className="text-sm">
                  <span className="font-medium">Auxiliares:</span>{" "}
                  {auxiliares.map((a: any) => a.employees?.name).join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Obra/Projeto */}
          <div>
            <label className="text-sm font-medium mb-1 block">Obra/Projeto</label>
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger><SelectValue placeholder="Selecionar obra..." /></SelectTrigger>
              <SelectContent>
                {(obras || []).map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name} {o.client ? `(${o.client})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Veículo */}
          <div>
            <label className="text-sm font-medium mb-1 block flex items-center gap-1">
              <Car className="w-4 h-4" /> Veículo
            </label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger><SelectValue placeholder="Selecionar veículo..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem veículo</SelectItem>
                {(vehicles || []).map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.model} — {v.plate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!hasChanges || isPending}>
            {isPending ? "Salvando..." : "Salvar e Sincronizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
