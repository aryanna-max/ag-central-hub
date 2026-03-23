import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  date: string;
  assignments: any[];
  absentEmployees: any[];
}

export default function DailyScheduleReport({ date, assignments, absentEmployees }: Props) {
  const d = new Date(date + "T12:00:00");
  const monthName = format(d, "MMMM yyyy", { locale: ptBR }).toUpperCase();

  return (
    <div className="print:p-4" id="daily-report">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">ESCALA {monthName}</h1>
      </div>

      <div className="bg-primary text-primary-foreground px-3 py-1.5 flex items-center justify-between rounded-t mb-0">
        <span className="font-bold text-sm">ACOMPANHAMENTO DIÁRIO DAS EQUIPES</span>
        <span className="text-sm">DATA: {format(d, "dd/MM/yyyy")}</span>
      </div>

      <table className="w-full border-collapse border border-border text-sm">
        <thead>
          <tr className="bg-muted">
            <th className="border border-border px-2 py-1.5 text-left w-8"></th>
            <th className="border border-border px-2 py-1.5 text-left">TOPÓGRAFO</th>
            <th className="border border-border px-2 py-1.5 text-left">AUXILIARES</th>
            <th className="border border-border px-2 py-1.5 text-left">PROJETO</th>
            <th className="border border-border px-2 py-1.5 text-left">VEÍCULO</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((a: any, idx: number) => {
            const members = a.teams?.team_members || [];
            const topografo = members.find((m: any) => m.role === "topografo");
            const auxiliares = members.filter((m: any) => m.role !== "topografo");

            return (
              <tr key={a.id} className="border-b border-border">
                <td className="border border-border px-2 py-1 font-bold text-center">{idx + 1}</td>
                <td className="border border-border px-2 py-1 font-bold uppercase">
                  {topografo?.employees?.name || "—"}
                </td>
                <td className="border border-border px-2 py-1">
                  {auxiliares.map((aux: any) => (
                    <div key={aux.id}>{aux.employees?.name}</div>
                  ))}
                  {auxiliares.length === 0 && "—"}
                </td>
                <td className="border border-border px-2 py-1">
                  <div>{a.projects?.name || a.projects?.client_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{a.projects?.location || ""}</div>
                </td>
                <td className="border border-border px-2 py-1">
                  <div>{a.vehicles?.model || "—"}</div>
                  <div className="text-xs text-muted-foreground">{a.vehicles?.plate || ""}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Absences section */}
      {absentEmployees.length > 0 && (
        <div className="mt-4">
          <table className="w-full border-collapse border border-border text-sm">
            <thead>
              <tr>
                <th className="border border-border px-2 py-1.5 bg-muted text-left">ATESTADO</th>
                <th className="border border-border px-2 py-1.5 bg-amber-100 text-left">FÉRIAS</th>
                <th className="border border-border px-2 py-1.5 bg-muted text-left">RETORNO</th>
                <th className="border border-border px-2 py-1.5 bg-yellow-200 text-left">FOLGA</th>
              </tr>
            </thead>
            <tbody>
              {absentEmployees.map((emp) => (
                <tr key={emp.id}>
                  <td className="border border-border px-2 py-1">
                    {emp.availability === "afastado" || emp.availability === "licenca" ? emp.name : ""}
                  </td>
                  <td className="border border-border px-2 py-1">
                    {emp.availability === "ferias" ? emp.name : ""}
                  </td>
                  <td className="border border-border px-2 py-1">
                    {emp.activeAbsence?.end_date
                      ? format(new Date(emp.activeAbsence.end_date + "T12:00:00"), "dd/MM/yy")
                      : ""}
                  </td>
                  <td className="border border-border px-2 py-1"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
