import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Props {
  employees: any[];
}

export default function AbsencesSection({ employees }: Props) {
  if (employees.length === 0) return null;

  const ferias = employees.filter((e) => e.availability === "ferias");
  const licenca = employees.filter((e) => e.availability === "licenca");
  const afastado = employees.filter((e) => e.availability === "afastado");

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-bold mb-3 text-muted-foreground">AUSÊNCIAS DO DIA</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ferias.length > 0 && (
            <div>
              <Badge className="bg-amber-500 text-white mb-2">Férias ({ferias.length})</Badge>
              {ferias.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-sm py-1">
                  <span>{e.name}</span>
                  {e.activeAbsence?.end_date && (
                    <span className="text-xs text-muted-foreground">
                      Retorno: {format(new Date(e.activeAbsence.end_date + "T12:00:00"), "dd/MM")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {licenca.length > 0 && (
            <div>
              <Badge className="bg-orange-500 text-white mb-2">Licença ({licenca.length})</Badge>
              {licenca.map((e) => (
                <div key={e.id} className="text-sm py-1">{e.name}</div>
              ))}
            </div>
          )}
          {afastado.length > 0 && (
            <div>
              <Badge className="bg-red-600 text-white mb-2">Afastado ({afastado.length})</Badge>
              {afastado.map((e) => (
                <div key={e.id} className="text-sm py-1">{e.name}</div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
