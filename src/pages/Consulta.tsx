import { useEffect, useRef, useState } from "react";
import { Search, Send, Loader2, AlertCircle, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { table: string; row_count: number }[];
}

const SHORTCUTS = [
  "Esse cliente já pagou?",
  "Quais projetos estão em campo agora?",
  "Quem tem integração com o cliente X?",
  "Histórico completo do cliente X",
  "NFs pendentes de emissão",
  "Qual o status do projeto X?",
];

export default function Consulta() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

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
    let body: { answer?: string; error?: string; sources?: { table: string; row_count: number }[] } = {};
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

    setMessages([...nextMessages, { role: "assistant", content: body.answer || "", sources: body.sources }]);
    setLoading(false);
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
            Pergunte em linguagem natural sobre clientes, projetos, propostas, medições e equipe.
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
                    : "max-w-[85%] space-y-2 text-sm"
                }
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.role === "assistant" && !!m.sources?.length && (
                  <div className="flex flex-wrap gap-1">
                    {m.sources.map((s, idx) => (
                      <Badge key={idx} variant="outline" className="text-[10px] gap-1">
                        <Database className="w-3 h-3" /> {s.table} · {s.row_count} registro(s)
                      </Badge>
                    ))}
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
