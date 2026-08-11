import { useEffect, useRef, useState } from "react";
import { Search, Send, Loader2, AlertCircle, Database, FileText, Check, Filter, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { generateNextCode } from "@/hooks/useProposals";

interface QuerySource {
  table: string;
  row_count: number;
  total_count?: number;
  page?: number;
  total_pages?: number;
  has_more?: boolean;
  next_offset?: number | null;
  filters?: { column: string; op: string; value: unknown }[];
}

interface DraftItem {
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sort_order: number;
}

interface ProposalDraft {
  client_id: string;
  client_name: string;
  title: string;
  location: string | null;
  scope: string | null;
  payment_conditions: string | null;
  validity_days: number;
  empresa_faturadora: string;
  items: DraftItem[];
  total: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: QuerySource[];
  draft?: ProposalDraft | null;
  draftSavedCode?: string;
}

const SHORTCUTS = [
  "Esse cliente já pagou?",
  "Quais projetos estão em campo agora?",
  "Quem tem integração com o cliente X?",
  "Histórico completo do cliente X",
  "NFs pendentes de emissão",
  "Qual o status do projeto X?",
  "Criar proposta para o cliente X",
];

const FILTER_SUGGESTIONS = [
  "Filtrar por cliente",
  "Filtrar por status",
  "Somente deste mês",
  "Ordenar pelos mais recentes",
];

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Consulta() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  const lastSources = messages.filter((m) => m.role === "assistant").at(-1)?.sources ?? [];
  const canPaginate = lastSources.some((s) => s.has_more);

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Sessão expirada. Faça login novamente.");
      setLoading(false);
      return;
    }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consulta-ia`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
    } catch (e) {
      setError(`Falha de rede ao consultar: ${(e as Error).message}`);
      setLoading(false);
      return;
    }

    const raw = await res.text();
    let body: {
      answer?: string;
      error?: string;
      sources?: QuerySource[];
      proposal_draft?: ProposalDraft | null;
    } = {};
    try {
      body = JSON.parse(raw);
    } catch {
      setError(`Resposta inválida do servidor (${res.status}): ${raw.slice(0, 300)}`);
      setLoading(false);
      return;
    }

    if (!res.ok || body.error) {
      setError(body.error || `Erro ${res.status} ao consultar.`);
      setLoading(false);
      return;
    }

    setMessages([
      ...nextMessages,
      { role: "assistant", content: body.answer || "", sources: body.sources, draft: body.proposal_draft ?? null },
    ]);
    setLoading(false);
  };

  const confirmDraft = async (index: number, draft: ProposalDraft) => {
    if (savingDraft) return;
    setSavingDraft(true);
    setError(null);
    try {
      const code = await generateNextCode();
      const { data: proposal, error: proposalError } = await supabase
        .from("proposals")
        .insert({
          code,
          title: draft.title,
          client_id: draft.client_id,
          scope: draft.scope,
          location: draft.location,
          payment_conditions: draft.payment_conditions,
          validity_days: draft.validity_days,
          empresa_faturadora: draft.empresa_faturadora,
          estimated_value: draft.total,
          final_value: draft.total,
          status: "rascunho",
        })
        .select("id, code")
        .single();

      if (proposalError) {
        throw new Error(
          proposalError.code === "23505"
            ? `O código ${code} já existe. Tente confirmar novamente.`
            : proposalError.message,
        );
      }

      if (draft.items.length > 0) {
        const { error: itemsError } = await supabase.from("proposal_items").insert(
          draft.items.map((item) => ({
            proposal_id: proposal.id,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            sort_order: item.sort_order,
          })),
        );
        if (itemsError) throw new Error(itemsError.message);
      }

      setMessages((current) =>
        current.map((m, i) => (i === index ? { ...m, draftSavedCode: proposal.code } : m)),
      );
      toast.success(`Proposta ${proposal.code} criada como rascunho.`);
    } catch (e) {
      setError(`Não foi possível criar a proposta: ${(e as Error).message}`);
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Search className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Consulta</h1>
          <p className="text-sm text-muted-foreground">
            Pergunte em linguagem natural sobre clientes, projetos, propostas, medições e equipe — ou peça para montar uma proposta.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SHORTCUTS.map((s) => (
          <Button key={s} variant="outline" size="sm" disabled={loading} onClick={() => ask(s)}>
            {s}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4 min-h-[320px] max-h-[55vh] overflow-y-auto">
          {messages.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-12">
              Nenhuma pergunta ainda. Use um atalho acima ou escreva sua pergunta abaixo.
            </p>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[80%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm"
                    : "max-w-[85%] w-full space-y-2 text-sm"
                }
              >
                <p className="whitespace-pre-wrap">{m.content}</p>

                {m.role === "assistant" && !!m.sources?.length && (
                  <div className="flex flex-wrap gap-1">
                    {m.sources.map((s, idx) => (
                      <Badge key={idx} variant="outline" className="text-[10px] gap-1">
                        <Database className="w-3 h-3" /> {s.table} ·{" "}
                        {typeof s.total_count === "number"
                          ? `${s.row_count} de ${s.total_count}`
                          : `${s.row_count} registro(s)`}
                        {s.total_pages && s.total_pages > 1 ? ` · pág. ${s.page}/${s.total_pages}` : ""}
                      </Badge>
                    ))}
                    {m.sources.flatMap((s, si) =>
                      (s.filters ?? []).map((f, fi) => (
                        <Badge key={`f-${si}-${fi}`} variant="secondary" className="text-[10px] gap-1">
                          <Filter className="w-3 h-3" /> {f.column} {f.op}
                          {f.value !== null && f.value !== undefined ? ` ${String(f.value)}` : ""}
                        </Badge>
                      )),
                    )}
                  </div>
                )}

                {m.role === "assistant" && m.draft && (
                  <div className="rounded-lg border border-border bg-card p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="font-semibold">Rascunho de proposta</span>
                      {m.draftSavedCode && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <Check className="w-3 h-3" /> {m.draftSavedCode}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Cliente</span>
                        <p className="font-medium">{m.draft.client_name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Título</span>
                        <p className="font-medium">{m.draft.title}</p>
                      </div>
                      {m.draft.location && (
                        <div>
                          <span className="text-muted-foreground">Local</span>
                          <p className="font-medium">{m.draft.location}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Validade</span>
                        <p className="font-medium">{m.draft.validity_days} dias</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {m.draft.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between gap-2 text-xs border-b border-border/50 pb-1">
                          <span>
                            {item.description}{" "}
                            <span className="text-muted-foreground">
                              ({item.quantity} {item.unit} × {money(item.unit_price)})
                            </span>
                          </span>
                          <span className="font-medium">{money(item.total_price)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-primary">{money(m.draft.total)}</span>
                      <Button
                        size="sm"
                        disabled={savingDraft || !!m.draftSavedCode}
                        onClick={() => confirmDraft(i, m.draft!)}
                        className="gap-2"
                      >
                        {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {m.draftSavedCode ? "Proposta criada" : "Confirmar e criar rascunho"}
                      </Button>
                    </div>

                    {!m.draftSavedCode && (
                      <p className="text-[11px] text-muted-foreground">
                        Nada foi gravado ainda. Peça ajustes no chat antes de confirmar.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Consultando o sistema...
            </div>
          )}

          <div ref={endRef} />
        </CardContent>
      </Card>

      {(canPaginate || messages.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {canPaginate && (
            <Button variant="secondary" size="sm" disabled={loading} onClick={() => ask("próxima página")} className="gap-1">
              Próxima página <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          )}
          {FILTER_SUGGESTIONS.map((s) => (
            <Button key={s} variant="outline" size="sm" disabled={loading} onClick={() => ask(s)} className="gap-1">
              <Filter className="w-3.5 h-3.5" /> {s}
            </Button>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="whitespace-pre-wrap">{error}</span>
        </div>
      )}

      <div className="flex gap-2 items-end">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          placeholder="Ex.: Qual o status do projeto 2026-BRK-001?"
          rows={2}
          className="flex-1"
        />
        <Button onClick={() => ask(input)} disabled={loading || !input.trim()} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Perguntar
        </Button>
      </div>
    </div>
  );
}
