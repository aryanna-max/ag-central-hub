import { useState, DragEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type KanbanColumn = "nao_alocado" | "folga" | "falta" | "atestado" | "reserva_ag";

interface Employee {
  id: string;
  name: string;
  role: string;
  status: string;
  availability?: string;
}

interface Props {
  /** All field employees (topógrafos + auxiliares) not in today's schedule */
  unassignedEmployees: Employee[];
  /** Employees explicitly marked in attendance as folga/falta/atestado/reserva for this date */
  attendanceMap: Record<string, string>;
  scheduleDate: string;
  dailyScheduleId: string | null;
}

const COLUMNS: { key: KanbanColumn; label: string; color: string; bgCard: string }[] = [
  { key: "nao_alocado", label: "Sem Alocação", color: "bg-muted-foreground", bgCard: "bg-muted/40" },
  { key: "folga", label: "Folga", color: "bg-green-600", bgCard: "bg-green-50 dark:bg-green-950/30" },
  { key: "falta", label: "Falta", color: "bg-red-600", bgCard: "bg-red-50 dark:bg-red-950/30" },
  { key: "atestado", label: "Atestado", color: "bg-amber-600", bgCard: "bg-amber-50 dark:bg-amber-950/30" },
  { key: "reserva_ag", label: "Reserva AG", color: "bg-blue-600", bgCard: "bg-blue-50 dark:bg-blue-950/30" },
];

export default function EmployeeAvailabilityKanban({
  unassignedEmployees,
  attendanceMap,
  scheduleDate,
  dailyScheduleId,
}: Props) {
  const qc = useQueryClient();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [hoverColumn, setHoverColumn] = useState<KanbanColumn | null>(null);
  const [localMap, setLocalMap] = useState<Record<string, string>>({});

  // Merge server attendance map with local optimistic updates
  const effectiveMap = { ...attendanceMap, ...localMap };

  const getColumn = (emp: Employee): KanbanColumn => {
    const status = effectiveMap[emp.id];
    if (status === "folga") return "folga";
    if (status === "falta") return "falta";
    if (status === "atestado") return "atestado";
    if (status === "reserva_ag") return "reserva_ag";
    return "nao_alocado";
  };

  const grouped: Record<KanbanColumn, Employee[]> = {
    nao_alocado: [],
    folga: [],
    falta: [],
    atestado: [],
    reserva_ag: [],
  };

  for (const emp of unassignedEmployees) {
    const col = getColumn(emp);
    grouped[col].push(emp);
  }

  const handleDragStart = (e: DragEvent, empId: string) => {
    setDraggedId(empId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", empId);
  };

  const handleDragOver = (e: DragEvent, col: KanbanColumn) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setHoverColumn(col);
  };

  const handleDragLeave = () => setHoverColumn(null);

  const handleDrop = async (e: DragEvent, targetCol: KanbanColumn) => {
    e.preventDefault();
    setHoverColumn(null);
    const empId = e.dataTransfer.getData("text/plain");
    if (!empId) return;
    setDraggedId(null);

    const currentCol = getColumn(unassignedEmployees.find((emp) => emp.id === empId)!);
    if (currentCol === targetCol) return;

    // Optimistic update
    if (targetCol === "nao_alocado") {
      const newMap = { ...localMap };
      delete newMap[empId];
      setLocalMap(newMap);
    } else {
      setLocalMap({ ...localMap, [empId]: targetCol });
    }

    try {
      if (targetCol === "nao_alocado") {
        // Remove attendance record
        await supabase
          .from("attendance")
          .delete()
          .eq("employee_id", empId)
          .eq("date", scheduleDate);
      } else {
        // Upsert attendance
        const { data: existing } = await supabase
          .from("attendance")
          .select("id")
          .eq("employee_id", empId)
          .eq("date", scheduleDate)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("attendance")
            .update({ status: targetCol, reasons: targetCol })
            .eq("id", existing.id);
        } else {
          await supabase.from("attendance").insert({
            employee_id: empId,
            date: scheduleDate,
            status: targetCol,
            reasons: targetCol,
          });
        }
      }
      qc.invalidateQueries({ queryKey: ["daily-schedule"] });
      qc.invalidateQueries({ queryKey: ["attendance", scheduleDate] });
    } catch {
      toast.error("Erro ao atualizar status do funcionário");
      // Revert
      const revertMap = { ...localMap };
      delete revertMap[empId];
      setLocalMap(revertMap);
    }
  };

  const isTopografo = (role: string) =>
    role?.toLowerCase().includes("topógrafo") || role?.toLowerCase().includes("topografo");

  const totalCount = unassignedEmployees.length;
  if (totalCount === 0) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
          Gestão de Disponibilidade — Funcionários de Campo ({totalCount})
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {COLUMNS.map((col) => {
            const items = grouped[col.key];
            const isOver = hoverColumn === col.key;
            return (
              <div
                key={col.key}
                className={`rounded-lg border-2 transition-colors min-h-[120px] ${
                  isOver ? "border-primary bg-primary/5" : "border-border"
                } ${col.bgCard}`}
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.key)}
              >
                <div className="p-2 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                    <span className="text-xs font-semibold uppercase tracking-wide">{col.label}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">
                      {items.length}
                    </Badge>
                  </div>
                </div>
                <div className="p-1.5 space-y-1 max-h-[300px] overflow-y-auto">
                  {items.length === 0 && (
                    <p className="text-[10px] text-muted-foreground text-center py-4 italic">
                      Arraste aqui
                    </p>
                  )}
                  {items.map((emp) => (
                    <div
                      key={emp.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, emp.id)}
                      className={`flex items-center gap-1.5 p-1.5 rounded-md border border-border/60 bg-card cursor-grab active:cursor-grabbing transition-shadow hover:shadow-sm ${
                        draggedId === emp.id ? "opacity-40" : ""
                      }`}
                    >
                      <Badge
                        variant={isTopografo(emp.role) ? "default" : "secondary"}
                        className="text-[9px] h-4 px-1 shrink-0"
                      >
                        {isTopografo(emp.role) ? "TOP" : "AUX"}
                      </Badge>
                      <span className="text-xs truncate leading-tight">
                        {emp.name.split(" ").slice(0, 2).join(" ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
