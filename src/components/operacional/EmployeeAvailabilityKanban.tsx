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
  unassignedEmployees: Employee[];
  attendanceMap: Record<string, string>;
  scheduleDate: string;
  dailyScheduleId: string | null;
  /** Employees with RH status (férias/licença/afastado) — shown as read-only badges */
  rhAbsentEmployees?: Employee[];
}

const ABSENCE_COLUMNS: { key: KanbanColumn; label: string; dotColor: string; bgCard: string }[] = [
  { key: "falta", label: "Falta", dotColor: "bg-red-600", bgCard: "bg-red-50 dark:bg-red-950/30" },
  { key: "folga", label: "Folga", dotColor: "bg-green-600", bgCard: "bg-green-50 dark:bg-green-950/30" },
  { key: "atestado", label: "Atestado", dotColor: "bg-amber-500", bgCard: "bg-amber-50 dark:bg-amber-950/30" },
];

const PRESENCE_COLUMNS: { key: KanbanColumn; label: string; dotColor: string; bgCard: string }[] = [
  { key: "reserva_ag", label: "Reserva AG", dotColor: "bg-blue-600", bgCard: "bg-blue-50 dark:bg-blue-950/30" },
];

export default function EmployeeAvailabilityKanban({
  unassignedEmployees,
  attendanceMap,
  scheduleDate,
  dailyScheduleId,
  rhAbsentEmployees = [],
}: Props) {
  const qc = useQueryClient();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [hoverColumn, setHoverColumn] = useState<KanbanColumn | null>(null);
  const [localMap, setLocalMap] = useState<Record<string, string>>({});

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
    grouped[getColumn(emp)].push(emp);
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

    if (targetCol === "nao_alocado") {
      const newMap = { ...localMap };
      delete newMap[empId];
      setLocalMap(newMap);
    } else {
      setLocalMap({ ...localMap, [empId]: targetCol });
    }

    try {
      if (targetCol === "nao_alocado") {
        await supabase.from("attendance").delete().eq("employee_id", empId).eq("date", scheduleDate);
      } else {
        const { data: existing } = await supabase
          .from("attendance")
          .select("id")
          .eq("employee_id", empId)
          .eq("date", scheduleDate)
          .maybeSingle();

        if (existing) {
          await supabase.from("attendance").update({ status: targetCol }).eq("id", existing.id);
        } else {
          await supabase.from("attendance").insert({
            employee_id: empId,
            date: scheduleDate,
            status: targetCol,
          });
        }
      }

      // Mark kanban as filled if at least 1 employee moved
      if (dailyScheduleId && targetCol !== "nao_alocado") {
        await supabase.from("daily_schedules").update({ kanban_filled: true }).eq("id", dailyScheduleId);
      }

      qc.invalidateQueries({ queryKey: ["daily-schedule"] });
      qc.invalidateQueries({ queryKey: ["attendance", scheduleDate] });
    } catch {
      toast.error("Erro ao atualizar status do funcionário");
      const revertMap = { ...localMap };
      delete revertMap[empId];
      setLocalMap(revertMap);
    }
  };

  const isTopografo = (role: string) =>
    role?.toLowerCase().includes("topógrafo") || role?.toLowerCase().includes("topografo");

  const isAuxiliar = (role: string) =>
    role?.toLowerCase().includes("auxiliar") || role?.toLowerCase().includes("ajudante");

  const totalCount = unassignedEmployees.length;
  const rhCount = rhAbsentEmployees.length;
  if (totalCount === 0 && rhCount === 0) return null;

  /** "João P." format */
  const formatEmployeeName = (emp: Employee) => {
    const parts = emp.name.trim().split(/\s+/);
    if (parts.length <= 1) return emp.name;
    const first = parts[0];
    const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || "";
    return `${first} ${lastInitial}.`;
  };

  const EmployeeChip = ({ emp, draggable: isDraggable = true }: { emp: Employee; draggable?: boolean }) => (
    <div
      draggable={isDraggable}
      onDragStart={isDraggable ? (e) => handleDragStart(e, emp.id) : undefined}
      title={emp.name}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/60 bg-card transition-shadow text-xs ${
        isDraggable ? "cursor-grab active:cursor-grabbing hover:shadow-sm" : "opacity-70 cursor-default"
      } ${draggedId === emp.id ? "opacity-40" : ""}`}
    >
      <Badge
        variant={isTopografo(emp.role) ? "default" : "secondary"}
        className="text-[9px] h-4 px-1 shrink-0"
      >
        {isTopografo(emp.role) ? "TOP" : "AUX"}
      </Badge>
      <span className="truncate leading-tight">
        {formatEmployeeName(emp)}
      </span>
    </div>
  );

  const DropColumn = ({ col, items }: { col: typeof ABSENCE_COLUMNS[0]; items: Employee[] }) => {
    const isOver = hoverColumn === col.key;
    return (
      <div
        className={`rounded-lg border-2 transition-colors min-h-[80px] flex-1 ${
          isOver ? "border-primary bg-primary/5" : "border-border"
        } ${col.bgCard}`}
        onDragOver={(e) => handleDragOver(e, col.key)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, col.key)}
      >
        <div className="p-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
            <span className="text-xs font-semibold uppercase tracking-wide">{col.label}</span>
            <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">{items.length}</Badge>
          </div>
        </div>
        <div className="p-1.5 flex flex-wrap gap-1 max-h-[200px] overflow-y-auto">
          {items.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-3 italic w-full">Arraste aqui</p>
          )}
          {items.map((emp) => <EmployeeChip key={emp.id} emp={emp} />)}
        </div>
      </div>
    );
  };

  const naoAlocadoIsOver = hoverColumn === "nao_alocado";

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-bold text-sm flex items-center gap-2">
          Gestão de Disponibilidade — Funcionários de Campo ({totalCount + rhCount})
        </h3>

        {/* Faixa horizontal: Sem Alocação */}
        <div
          className={`rounded-lg border-2 transition-colors ${
            naoAlocadoIsOver ? "border-primary bg-primary/5" : "border-border"
          } bg-muted/40`}
          onDragOver={(e) => handleDragOver(e, "nao_alocado")}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, "nao_alocado")}
        >
          <div className="p-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wide">Sem Alocação</span>
              <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">{grouped.nao_alocado.length}</Badge>
            </div>
          </div>
          <div className="p-2 flex flex-wrap gap-1.5 min-h-[40px]">
            {grouped.nao_alocado.length === 0 && (
              <p className="text-[10px] text-muted-foreground italic py-1">Todos alocados ou categorizados</p>
            )}
            {grouped.nao_alocado.map((emp) => <EmployeeChip key={emp.id} emp={emp} />)}
          </div>
        </div>

        {/* Colunas horizontais: Ausências + Presença */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ABSENCE_COLUMNS.map((col) => (
            <DropColumn key={col.key} col={col} items={grouped[col.key]} />
          ))}
          {PRESENCE_COLUMNS.map((col) => (
            <DropColumn key={col.key} col={col} items={grouped[col.key]} />
          ))}
        </div>

        {/* RH auto-status (read-only) */}
        {rhAbsentEmployees.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Status RH (automático — somente leitura)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {rhAbsentEmployees.map((emp) => (
                <div key={emp.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/40 bg-muted/60 text-xs opacity-70">
                  <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0 bg-muted text-muted-foreground">
                    {emp.availability === "ferias" ? "FÉRIAS" : emp.availability === "licenca" ? "LICENÇA" : "AFAST."}
                  </Badge>
                  <span className="truncate leading-tight">{emp.name.split(" ").slice(0, 2).join(" ")}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
