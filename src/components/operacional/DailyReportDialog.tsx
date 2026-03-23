import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileImage, FileText, FileSpreadsheet, Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import html2canvas from "html2canvas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
  assignments: any[];
  entries: any[];
  absentEmployees: any[];
  attendanceRecords: any[];
  kanbanFilled: boolean;
  allEmployees: any[];
  createdBy?: string;
}

const PROJECT_COLORS = [
  "#f0faf4", "#eef6ff", "#fef9ee", "#faf0f4", "#f0f4fa",
  "#f5faf0", "#fef0f0", "#f0fafa", "#f8f0fa", "#fafaf0",
];

export default function DailyReportDialog({
  open,
  onOpenChange,
  date,
  assignments,
  entries,
  absentEmployees,
  attendanceRecords,
  kanbanFilled,
  allEmployees,
  createdBy,
}: Props) {
  const [mode, setMode] = useState<"select" | "planning" | "confirmed">("select");
  const reportRef = useRef<HTMLDivElement>(null);
  const d = new Date(date + "T12:00:00");
  const dateStr = format(d, "dd/MM/yyyy (EEEE)", { locale: ptBR });
  const now = new Date();

  const saveAsPng = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: "#ffffff", width: 800 });
    const link = document.createElement("a");
    link.download = `escala-${date}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const exportCsv = () => {
    const rows: string[][] = [["Projeto", "Função", "Funcionário", "Veículo"]];
    assignments.forEach((a: any) => {
      const members = a.teams?.team_members || [];
      const projectName = a.projects?.name || a.projects?.client_name || "—";
      const vehicle = a.vehicles ? `${a.vehicles.model} ${a.vehicles.plate}` : "—";
      members.forEach((m: any) => {
        const role = m.role === "topografo" ? "Topógrafo" : "Auxiliar";
        rows.push([projectName, role, m.employees?.name || "—", vehicle]);
      });
    });

    // Reserva AG
    const reservaEmps = attendanceRecords.filter((r: any) => r.status === "reserva_ag");
    reservaEmps.forEach((r: any) => {
      const emp = allEmployees.find((e: any) => e.id === r.employee_id);
      rows.push(["Reserva AG", "—", emp?.name || "—", "—"]);
    });

    // Ausências
    const absTypes = ["falta", "folga", "atestado"];
    absTypes.forEach((t) => {
      attendanceRecords.filter((r: any) => r.status === t).forEach((r: any) => {
        const emp = allEmployees.find((e: any) => e.id === r.employee_id);
        rows.push([t.charAt(0).toUpperCase() + t.slice(1), "—", emp?.name || "—", "—"]);
      });
    });

    const csvContent = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `escala-confirmada-${date}.csv`;
    link.click();
  };

  const handlePrint = () => {
    if (!reportRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Escala ${dateStr}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:auto}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
      th{background:#f5f5f5;font-weight:bold}
      .badge{display:inline-block;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:bold;color:#fff}
      </style></head><body>${reportRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  const isTopografo = (role: string) =>
    role?.toLowerCase().includes("topógrafo") || role?.toLowerCase().includes("topografo");

  // Planning Report Content
  const PlanningReport = () => (
    <div ref={reportRef} style={{ width: 800, background: "#fff", padding: 24, fontFamily: "Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 16, borderBottom: "3px solid #006B54", paddingBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: "bold", color: "#006B54", margin: 0 }}>AG TOPOGRAFIA</h1>
        <p style={{ fontSize: 16, margin: "4px 0 0", color: "#333" }}>Escala de Campo — {dateStr}</p>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ background: "#006B54", color: "#fff" }}>
            <th style={{ padding: "8px 10px", textAlign: "left", border: "1px solid #005544" }}>#</th>
            <th style={{ padding: "8px 10px", textAlign: "left", border: "1px solid #005544" }}>Projeto</th>
            <th style={{ padding: "8px 10px", textAlign: "left", border: "1px solid #005544" }}>Equipe</th>
            <th style={{ padding: "8px 10px", textAlign: "left", border: "1px solid #005544" }}>Funcionários</th>
            <th style={{ padding: "8px 10px", textAlign: "left", border: "1px solid #005544" }}>Veículo</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((a: any, idx: number) => {
            const members = a.teams?.team_members || [];
            const bg = idx % 2 === 0 ? "#ffffff" : "#f0faf4";
            return (
              <tr key={a.id} style={{ background: bg }}>
                <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0", fontWeight: "bold", textAlign: "center" }}>{idx + 1}</td>
                <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0", fontWeight: 500 }}>
                  {a.projects?.name || "—"}
                  {a.projects?.client_name && <div style={{ fontSize: 11, color: "#777" }}>{a.projects.client_name}</div>}
                </td>
                <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>{a.teams?.name || "—"}</td>
                <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>
                  {members.map((m: any) => (
                    <div key={m.id} style={{ marginBottom: 2 }}>
                      <span
                        className="badge"
                        style={{
                          display: "inline-block",
                          padding: "1px 5px",
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: "bold",
                          color: "#fff",
                          background: isTopografo(m.role) ? "#166534" : "#2563eb",
                          marginRight: 4,
                        }}
                      >
                        {isTopografo(m.role) ? "TOP" : "AUX"}
                      </span>
                      {m.employees?.name || "—"}
                    </div>
                  ))}
                </td>
                <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>
                  {a.vehicles ? `${a.vehicles.model} — ${a.vehicles.plate}` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 16, fontSize: 11, color: "#999", borderTop: "1px solid #eee", paddingTop: 8 }}>
        Gerado por {createdBy || "Sistema"} em {format(now, "dd/MM/yyyy HH:mm")}
      </div>
    </div>
  );

  // Confirmed Report Content
  const ConfirmedReport = () => {
    const reservaEmps = attendanceRecords.filter((r: any) => r.status === "reserva_ag");
    const faltaEmps = attendanceRecords.filter((r: any) => r.status === "falta");
    const folgaEmps = attendanceRecords.filter((r: any) => r.status === "folga");
    const atestadoEmps = attendanceRecords.filter((r: any) => r.status === "atestado");
    const feriasEmps = absentEmployees.filter((e: any) => e.availability === "ferias");
    const licencaEmps = absentEmployees.filter((e: any) => e.availability === "licenca" || e.availability === "afastado");

    // Group assignments by project for alternating colors
    let projectColorIdx = 0;
    const projectColorMap: Record<string, string> = {};
    assignments.forEach((a: any) => {
      const pid = a.projects?.id || a.id;
      if (!projectColorMap[pid]) {
        projectColorMap[pid] = PROJECT_COLORS[projectColorIdx % PROJECT_COLORS.length];
        projectColorIdx++;
      }
    });

    const getName = (empId: string) => allEmployees.find((e: any) => e.id === empId)?.name || "—";

    return (
      <div ref={reportRef} style={{ width: 800, background: "#fff", padding: 24, fontFamily: "Arial, sans-serif" }}>
        <div style={{ textAlign: "center", marginBottom: 16, borderBottom: "3px solid #006B54", paddingBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: "bold", color: "#006B54", margin: 0 }}>AG TOPOGRAFIA</h1>
          <p style={{ fontSize: 16, margin: "4px 0 0", color: "#333" }}>Escala Confirmada — {dateStr}</p>
        </div>

        {/* EM CAMPO */}
        <h2 style={{ fontSize: 15, fontWeight: "bold", color: "#006B54", margin: "16px 0 8px", textTransform: "uppercase" }}>
          Em Campo
        </h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#006B54", color: "#fff" }}>
              <th style={{ padding: "8px 10px", textAlign: "left", border: "1px solid #005544" }}>Projeto</th>
              <th style={{ padding: "8px 10px", textAlign: "left", border: "1px solid #005544" }}>Função</th>
              <th style={{ padding: "8px 10px", textAlign: "left", border: "1px solid #005544" }}>Nome</th>
              <th style={{ padding: "8px 10px", textAlign: "left", border: "1px solid #005544" }}>Veículo</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a: any) => {
              const members = a.teams?.team_members || [];
              const bg = projectColorMap[a.projects?.id || a.id] || "#fff";
              const vehicle = a.vehicles ? `${a.vehicles.model} — ${a.vehicles.plate}` : "—";
              return members.map((m: any, mIdx: number) => (
                <tr key={m.id} style={{ background: bg }}>
                  <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0", fontWeight: mIdx === 0 ? 600 : 400 }}>
                    {mIdx === 0 ? (a.projects?.name || "—") : ""}
                  </td>
                  <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>
                    <span style={{
                      display: "inline-block", padding: "1px 5px", borderRadius: 4,
                      fontSize: 10, fontWeight: "bold", color: "#fff",
                      background: isTopografo(m.role) ? "#166534" : "#2563eb",
                    }}>
                      {isTopografo(m.role) ? "TOP" : "AUX"}
                    </span>
                  </td>
                  <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>{m.employees?.name || "—"}</td>
                  <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>{mIdx === 0 ? vehicle : ""}</td>
                </tr>
              ));
            })}
          </tbody>
        </table>

        {/* RESERVA AG */}
        {reservaEmps.length > 0 && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: "bold", color: "#2563eb", margin: "20px 0 8px", textTransform: "uppercase" }}>
              Reserva AG (Sede)
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <tbody>
                {reservaEmps.map((r: any, i: number) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? "#eef6ff" : "#fff" }}>
                    <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>
                      <span style={{ display: "inline-block", padding: "1px 5px", borderRadius: 4, fontSize: 10, fontWeight: "bold", color: "#fff", background: "#2563eb", marginRight: 6 }}>RESERVA</span>
                      {getName(r.employee_id)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* AUSÊNCIAS */}
        {(faltaEmps.length > 0 || folgaEmps.length > 0 || atestadoEmps.length > 0 || feriasEmps.length > 0 || licencaEmps.length > 0) && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: "bold", color: "#dc2626", margin: "20px 0 8px", textTransform: "uppercase" }}>
              Ausências
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ padding: "6px 10px", textAlign: "left", border: "1px solid #e0e0e0" }}>Status</th>
                  <th style={{ padding: "6px 10px", textAlign: "left", border: "1px solid #e0e0e0" }}>Funcionário</th>
                </tr>
              </thead>
              <tbody>
                {faltaEmps.map((r: any) => (
                  <tr key={r.id} style={{ background: "#fef2f2" }}>
                    <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>
                      <span style={{ padding: "1px 5px", borderRadius: 4, fontSize: 10, fontWeight: "bold", color: "#fff", background: "#dc2626" }}>FALTA</span>
                    </td>
                    <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>{getName(r.employee_id)}</td>
                  </tr>
                ))}
                {folgaEmps.map((r: any) => (
                  <tr key={r.id} style={{ background: "#f0fdf4" }}>
                    <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>
                      <span style={{ padding: "1px 5px", borderRadius: 4, fontSize: 10, fontWeight: "bold", color: "#fff", background: "#16a34a" }}>FOLGA</span>
                    </td>
                    <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>{getName(r.employee_id)}</td>
                  </tr>
                ))}
                {atestadoEmps.map((r: any) => (
                  <tr key={r.id} style={{ background: "#fffbeb" }}>
                    <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>
                      <span style={{ padding: "1px 5px", borderRadius: 4, fontSize: 10, fontWeight: "bold", color: "#fff", background: "#d97706" }}>ATESTADO</span>
                    </td>
                    <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>{getName(r.employee_id)}</td>
                  </tr>
                ))}
                {feriasEmps.map((e: any) => (
                  <tr key={e.id} style={{ background: "#f5f5f5" }}>
                    <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>
                      <span style={{ padding: "1px 5px", borderRadius: 4, fontSize: 10, fontWeight: "bold", color: "#fff", background: "#6b7280" }}>FÉRIAS</span>
                    </td>
                    <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>{e.name}</td>
                  </tr>
                ))}
                {licencaEmps.map((e: any) => (
                  <tr key={e.id} style={{ background: "#f5f5f5" }}>
                    <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>
                      <span style={{ padding: "1px 5px", borderRadius: 4, fontSize: 10, fontWeight: "bold", color: "#fff", background: "#6b7280" }}>
                        {e.availability === "licenca" ? "LICENÇA" : "AFASTADO"}
                      </span>
                    </td>
                    <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>{e.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div style={{ marginTop: 16, fontSize: 11, color: "#999", borderTop: "1px solid #eee", paddingTop: 8 }}>
          Confirmado por {createdBy || "Sistema"} em {format(now, "dd/MM/yyyy HH:mm")}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setMode("select"); }}>
      <DialogContent className="max-w-[860px] max-h-[90vh] overflow-y-auto">
        {mode === "select" ? (
          <>
            <DialogHeader>
              <DialogTitle>Gerar Relatório — {dateStr}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <button
                onClick={() => setMode("planning")}
                className="p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors text-left space-y-2"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="font-bold text-sm">Escala de Planejamento</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Para o dia seguinte. Mostra o plano: equipes, projetos, funcionários, veículos. Ideal para enviar no WhatsApp.
                </p>
              </button>
              <button
                onClick={() => {
                  if (!kanbanFilled) {
                    toast.error("O Kanban de disponibilidade ainda não foi preenchido para este dia.");
                    return;
                  }
                  setMode("confirmed");
                }}
                className={`p-6 rounded-lg border-2 transition-colors text-left space-y-2 ${
                  kanbanFilled
                    ? "border-border hover:border-primary hover:bg-primary/5"
                    : "border-border/50 opacity-60 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <span className="font-bold text-sm">Escala Confirmada</span>
                  {!kanbanFilled && <Badge variant="destructive" className="text-[10px]">Kanban pendente</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Realidade do dia. Cruza planejamento com kanban preenchido. Inclui reservas e ausências.
                </p>
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setMode("select")}>← Voltar</Button>
                  <span>{mode === "planning" ? "Escala de Planejamento" : "Escala Confirmada"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={saveAsPng} variant="outline" size="sm" className="gap-1">
                    <FileImage className="w-3.5 h-3.5" /> Salvar PNG
                  </Button>
                  <Button onClick={handlePrint} variant="outline" size="sm" className="gap-1">
                    <Printer className="w-3.5 h-3.5" /> PDF/Imprimir
                  </Button>
                  {mode === "confirmed" && (
                    <Button onClick={exportCsv} variant="outline" size="sm" className="gap-1">
                      <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
                    </Button>
                  )}
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-x-auto">
              {mode === "planning" ? <PlanningReport /> : <ConfirmedReport />}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

