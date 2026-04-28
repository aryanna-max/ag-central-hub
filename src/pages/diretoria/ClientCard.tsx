import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Lightbulb,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type {
  ClientCockpitRow,
  ClientCockpitSignal,
  ClientHealthSign,
} from "@/hooks/useClientCockpit";

const SEMAFORO_BG: Record<ClientHealthSign, string> = {
  vermelho:
    "border-red-300 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20",
  amarelo:
    "border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20",
  verde:
    "border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10",
};

const SEMAFORO_DOT: Record<ClientHealthSign, string> = {
  vermelho: "bg-red-500",
  amarelo: "bg-amber-500",
  verde: "bg-emerald-500",
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function SignalRow({ signal }: { signal: ClientCockpitSignal }) {
  const icon =
    signal.severity === "vermelho" ? (
      <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
    ) : signal.severity === "amarelo" ? (
      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
    ) : (
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
    );

  return (
    <div className="flex items-start gap-1.5 text-[11px]">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="leading-tight">
          {signal.message}
          {signal.value !== undefined && (
            <span className="text-muted-foreground"> · {fmtBRL(signal.value)}</span>
          )}
        </p>
        {signal.suggestion && (
          <p className="text-[10px] text-muted-foreground italic flex items-center gap-1 mt-0.5">
            <Lightbulb className="h-2.5 w-2.5" /> {signal.suggestion}
          </p>
        )}
      </div>
    </div>
  );
}

export interface ClientCardProps {
  row: ClientCockpitRow;
  onOpenDetails: () => void;
  onOpenAprofundado: () => void;
}

export default function ClientCard({
  row,
  onOpenDetails,
  onOpenAprofundado,
}: ClientCardProps) {
  const visibleSignals =
    row.signals[0]?.type === "em_dia" ? [] : row.signals.slice(0, 2);
  const moreCount = row.signals.length - visibleSignals.length;
  const isEmDia = row.signals.length === 1 && row.signals[0]?.type === "em_dia";

  return (
    <Card className={cn("border-l-4 transition-all hover:shadow-md", SEMAFORO_BG[row.semaforo])}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={cn("inline-block h-2 w-2 rounded-full", SEMAFORO_DOT[row.semaforo])} />
              <h3 className="font-semibold text-sm truncate">{row.client.name}</h3>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {row.segmento ?? "Sem segmento"}
              {row.cnpjPrincipal && <> · {row.cnpjPrincipal}</>}
            </p>
            {row.comercialResponsavel && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Comercial: <span className="font-medium">{row.comercialResponsavel}</span>
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <p className="text-muted-foreground">Projetos ativos</p>
            <p className="font-bold text-base leading-tight">{row.kpis.projetosAtivos}</p>
          </div>
          <div>
            <p className="text-muted-foreground">A receber</p>
            <p className="font-bold text-base leading-tight">
              {row.kpis.aReceber > 0 ? fmtBRL(row.kpis.aReceber) : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Alertas</p>
            <p className="font-bold text-base leading-tight">{row.kpis.alertas}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Última atividade</p>
            <p className="font-bold text-[11px] leading-tight">
              {row.kpis.ultimaAtividade
                ? formatDistanceToNow(new Date(row.kpis.ultimaAtividade), {
                    addSuffix: true,
                    locale: ptBR,
                  })
                : "—"}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          {isEmDia ? (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Em dia</span>
              {row.kpis.ultimaAtividade && (
                <span className="text-muted-foreground">
                  · última atividade{" "}
                  {formatDistanceToNow(new Date(row.kpis.ultimaAtividade), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              )}
            </div>
          ) : (
            <>
              {visibleSignals.map((s, idx) => (
                <SignalRow key={idx} signal={s} />
              ))}
              {moreCount > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  +{moreCount} sinal{moreCount > 1 ? "ais" : ""}
                </Badge>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 flex-1"
            onClick={onOpenDetails}
          >
            Detalhes
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs h-7"
            onClick={onOpenAprofundado}
          >
            Aprofundado <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
