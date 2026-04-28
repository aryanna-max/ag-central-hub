import { useClientInsights } from "@/hooks/useClientInsights";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, Clock, Calendar, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function InsuficientText() {
  return (
    <p className="text-[11px] text-muted-foreground italic">
      Dados insuficientes para cálculo
    </p>
  );
}

export default function ClientInsightsSection({ clientId }: { clientId: string }) {
  const { data, isLoading } = useClientInsights(clientId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!data) return <InsuficientText />;

  const {
    receitaTrimestreVsAnterior: receita,
    padraoAtraso: atraso,
    frequenciaProjetos: freq,
    tempoMedioPagamento: pagto,
  } = data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
      {/* Receita Q vs Q-1 */}
      <div className="rounded-lg border p-3 space-y-1">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
          <Calendar className="h-3 w-3" /> Receita trimestre
        </div>
        {receita ? (
          <>
            <div className="font-bold">{fmtBRL(receita.atual)}</div>
            <div className="flex items-center gap-1 text-[11px]">
              {receita.variacaoPct > 0 ? (
                <TrendingUp className="h-3 w-3 text-emerald-600" />
              ) : receita.variacaoPct < 0 ? (
                <TrendingDown className="h-3 w-3 text-red-600" />
              ) : (
                <Minus className="h-3 w-3 text-muted-foreground" />
              )}
              <span
                className={cn(
                  receita.variacaoPct > 0 && "text-emerald-700",
                  receita.variacaoPct < 0 && "text-red-700",
                )}
              >
                {receita.variacaoPct > 0 ? "+" : ""}
                {receita.variacaoPct}% vs trimestre anterior
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Anterior: {fmtBRL(receita.anterior)}
            </div>
          </>
        ) : (
          <InsuficientText />
        )}
      </div>

      {/* Padrão atraso 6m */}
      <div className="rounded-lg border p-3 space-y-1">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
          <Clock className="h-3 w-3" /> Atraso entrega (6m)
        </div>
        {atraso ? (
          <>
            <div className="font-bold">{atraso.pct}%</div>
            <div className="text-[11px] text-muted-foreground">
              {atraso.projetosAtrasados} de {atraso.totalProjetos} projetos atrasados
            </div>
          </>
        ) : (
          <InsuficientText />
        )}
      </div>

      {/* Frequência projetos 12m */}
      <div className="rounded-lg border p-3 space-y-1">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
          <Repeat className="h-3 w-3" /> Frequência projetos (12m)
        </div>
        {freq ? (
          <>
            <div className="font-bold">{freq.projetos12Meses}</div>
            <div className="text-[11px] text-muted-foreground">
              {freq.intervaloMedioDias !== null
                ? `Intervalo médio: ${freq.intervaloMedioDias}d`
                : "Intervalo: dados insuficientes"}
              {freq.tendencia && (
                <span className="ml-1">
                  ·{" "}
                  {freq.tendencia === "aumentando"
                    ? "↑ aumentando"
                    : freq.tendencia === "diminuindo"
                      ? "↓ diminuindo"
                      : "→ estável"}
                </span>
              )}
            </div>
          </>
        ) : (
          <InsuficientText />
        )}
      </div>

      {/* Tempo médio pagamento */}
      <div className="rounded-lg border p-3 space-y-1">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
          <Clock className="h-3 w-3" /> Tempo médio pagamento
        </div>
        {pagto ? (
          pagto.diasMedioPagamento !== null ? (
            <>
              <div className="font-bold">{pagto.diasMedioPagamento} dias</div>
              <div className="text-[11px] text-muted-foreground">
                Base: {pagto.nfsConsideradas} NF{pagto.nfsConsideradas > 1 ? "s" : ""} paga{pagto.nfsConsideradas > 1 ? "s" : ""}
              </div>
            </>
          ) : (
            <>
              <div className="text-[11px] text-muted-foreground">
                {pagto.nfsConsideradas} NF paga — mínimo 3 para média confiável
              </div>
              <InsuficientText />
            </>
          )
        ) : (
          <InsuficientText />
        )}
      </div>
    </div>
  );
}
