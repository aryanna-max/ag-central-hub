import { useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FileImage, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import html2canvas from "html2canvas";
import { toast } from "sonner";

interface TeamGroup {
  id: string;
  teamName: string;
  projectName: string | null;
  vehicleName: string | null;
  members: { id: string; name: string; role: string; attendance: string | null }[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
  teamGroups: TeamGroup[];
}

const isTopografo = (role: string) =>
  role?.toLowerCase().includes("topógrafo") || role?.toLowerCase().includes("topografo");

export default function MobileScheduleReportSheet({ open, onOpenChange, date, teamGroups }: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const d = new Date(date + "T12:00:00");
  const dateStr = format(d, "dd/MM/yyyy (EEEE)", { locale: ptBR });

  const saveAsPng = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        width: 800,
        windowWidth: 800,
      });
      const link = document.createElement("a");
      link.download = `escala-${date}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("PNG salvo!");
    } catch {
      toast.error("Erro ao gerar PNG");
    } finally {
      setExporting(false);
    }
  };

  const saveAsPdf = () => {
    if (!reportRef.current) return;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Popup bloqueado. Permita popups para gerar PDF.");
      return;
    }
    w.document.write(`<html><head><title>Escala ${dateStr}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:auto}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
        th{background:#006B54;color:#fff;font-weight:bold}
        .badge{display:inline-block;padding:1px 5px;border-radius:4px;font-size:10px;font-weight:bold;color:#fff;margin-right:4px}
        @media print{body{padding:10px}}
      </style></head><body>${reportRef.current.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="text-lg">Relatório da Escala</SheetTitle>
        </SheetHeader>

        {/* Export buttons */}
        <div className="px-5 py-3 flex gap-3 border-b">
          <Button onClick={saveAsPng} disabled={exporting} className="flex-1 gap-2" variant="outline">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileImage className="w-4 h-4" />}
            Salvar PNG
          </Button>
          <Button onClick={saveAsPdf} className="flex-1 gap-2" variant="outline">
            <FileText className="w-4 h-4" />
            Imprimir / PDF
          </Button>
        </div>

        {/* Report preview (scrollable) */}
        <div className="flex-1 overflow-auto bg-muted/30 p-3">
          <div className="overflow-x-auto">
            <div
              ref={reportRef}
              style={{
                width: 800,
                background: "#fff",
                padding: 24,
                fontFamily: "Arial, sans-serif",
              }}
            >
              {/* Header */}
              <div style={{ textAlign: "center", marginBottom: 16, borderBottom: "3px solid #006B54", paddingBottom: 12 }}>
                <h1 style={{ fontSize: 22, fontWeight: "bold", color: "#006B54", margin: 0 }}>AG TOPOGRAFIA</h1>
                <p style={{ fontSize: 16, margin: "4px 0 0", color: "#333" }}>Escala de Campo — {dateStr}</p>
              </div>

              {/* Table */}
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
                  {teamGroups.map((team, idx) => {
                    const bg = idx % 2 === 0 ? "#ffffff" : "#f0faf4";
                    return (
                      <tr key={team.id} style={{ background: bg }}>
                        <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0", fontWeight: "bold", textAlign: "center" }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0", fontWeight: 500 }}>
                          {team.projectName || "—"}
                        </td>
                        <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>
                          {team.teamName}
                        </td>
                        <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>
                          {team.members.map((m) => (
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
                              {m.name}
                            </div>
                          ))}
                          {team.members.length === 0 && "—"}
                        </td>
                        <td style={{ padding: "6px 10px", border: "1px solid #e0e0e0" }}>
                          {team.vehicleName || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Footer */}
              <div style={{ marginTop: 16, fontSize: 11, color: "#999", borderTop: "1px solid #eee", paddingTop: 8 }}>
                Gerado em {format(new Date(), "dd/MM/yyyy HH:mm")}
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
