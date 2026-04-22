import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, X, MessageSquare, Loader2, AlertTriangle } from "lucide-react";

// -----------------------------------------------------------------------------
// Tipos locais — espelham o schema de field_expense_sheets/items (Supabase).
// Quando Lovable regenerar types.ts pós-merge de event_log, podemos trocar por
// `Tables<"field_expense_sheets">` etc.
// -----------------------------------------------------------------------------

interface ApprovalComment {
  action: "aprovada" | "questionada";
  by: string;
  at: string;
  text: string | null;
}

interface SheetData {
  id: string;
  codigo: string | null;
  status: string;
  period_start: string;
  period_end: string;
  total_value: number | null;
  week_label: string | null;
  approved_at: string | null;
  approval_comments: ApprovalComment[] | null;
  return_comment: string | null;
}

interface EmployeeRef {
  name: string;
}

interface ItemData {
  id: string;
  expense_type: string;
  description: string;
  value: number;
  payment_method: string;
  project_name: string | null;
  receiver_name: string | null;
  employees: EmployeeRef | null;
}

interface ApproveResponse {
  ok: boolean;
  emailEnqueued?: boolean;
  error?: string;
  detail?: string;
}

type DoneState =
  | { kind: "aprovada"; emailEnqueued: boolean }
  | { kind: "questionada" };

export default function AprovacaoExterna() {
  const { token } = useParams<{ token: string }>();
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [items, setItems] = useState<ItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<DoneState | null>(null);

  useEffect(() => {
    if (!token) return;
    loadSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadSheet = async () => {
    setLoading(true);
    setError(null);

    const { data: sheetData, error: sErr } = await supabase
      .from("field_expense_sheets")
      .select(
        "id, codigo, status, period_start, period_end, total_value, week_label, approved_at, approval_comments, return_comment"
      )
      .eq("approval_token", token!)
      .maybeSingle<SheetData>();

    if (sErr || !sheetData) {
      setError("Folha de despesa não encontrada ou link inválido.");
      setLoading(false);
      return;
    }

    const { data: itemsData } = await supabase
      .from("field_expense_items")
      .select(
        "id, expense_type, description, value, payment_method, project_name, receiver_name, employees!field_expense_items_employee_id_fkey(name)"
      )
      .eq("sheet_id", sheetData.id)
      .order("created_at")
      .returns<ItemData[]>();

    setSheet(sheetData);
    setItems(itemsData ?? []);
    setLoading(false);
  };

  // Bug 5 fix — chama Edge Function approve-expense-sheet em vez de
  // enqueue_email direto (que exigia service_role e nunca funcionava).
  const submitDecision = async (action: "aprovada" | "questionada") => {
    if (!sheet || !token) return;
    if (action === "questionada" && !comment.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const { data, error: invokeErr } = await supabase.functions.invoke<ApproveResponse>(
        "approve-expense-sheet",
        {
          body: {
            token,
            action,
            comment: comment.trim() || undefined,
            approver_label: "Diretoria Comercial",
          },
        }
      );

      if (invokeErr) {
        setError(
          "Erro ao enviar decisão. Tente novamente ou entre em contato com o administrador."
        );
        setSubmitting(false);
        return;
      }

      if (!data?.ok) {
        const friendly = friendlyErrorMessage(data?.error);
        setError(friendly);
        setSubmitting(false);
        return;
      }

      if (action === "aprovada") {
        setDone({ kind: "aprovada", emailEnqueued: data.emailEnqueued ?? false });
      } else {
        setDone({ kind: "questionada" });
      }
    } catch (err) {
      console.error("[AprovacaoExterna] invoke exception:", err);
      setError(
        "Erro de conexão ao enviar decisão. Verifique sua internet e tente novamente."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = () => submitDecision("aprovada");
  const handleQuestion = () => submitDecision("questionada");

  const formatCurrency = (v: number) =>
    `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !sheet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow p-6 max-w-sm text-center">
          <X className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!sheet) return null;

  const isAlreadyResolved = sheet.status === "aprovado" || sheet.status === "pago";

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow p-6 max-w-sm text-center">
          {done.kind === "aprovada" ? (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Folha Aprovada</h2>
              {done.emailEnqueued ? (
                <p className="text-sm text-gray-500">
                  O Financeiro foi notificado por email.
                </p>
              ) : (
                <p className="text-sm text-amber-600">
                  Aprovação registrada. O email para o Financeiro não pôde ser
                  enviado automaticamente — avise Alcione por outro canal.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Questionamento Enviado
              </h2>
              <p className="text-sm text-gray-500">
                O Gerente Operacional será notificado para corrigir. Este link
                continuará válido.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-bold text-gray-900">Folha de Despesas</h1>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                isAlreadyResolved
                  ? "bg-green-100 text-green-700"
                  : sheet.status === "devolvido"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-blue-100 text-blue-700"
              }`}
            >
              {isAlreadyResolved
                ? "Aprovada"
                : sheet.status === "devolvido"
                  ? "Devolvida"
                  : "Aguardando aprovação"}
            </span>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            {sheet.codigo && (
              <p className="font-mono font-bold text-blue-700">{sheet.codigo}</p>
            )}
            <p>
              {sheet.week_label ||
                `Semana ${format(new Date(sheet.period_start), "dd/MM")} a ${format(
                  new Date(sheet.period_end),
                  "dd/MM"
                )}`}
            </p>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(sheet.total_value || 0)}
            </p>
          </div>
          {isAlreadyResolved && sheet.approved_at && (
            <p className="text-xs text-green-600 mt-2">
              Aprovada em{" "}
              {format(new Date(sheet.approved_at), "dd/MM/yyyy 'às' HH:mm", {
                locale: ptBR,
              })}
            </p>
          )}
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-2 border-b">
            <h2 className="text-sm font-semibold text-gray-700">
              {items.length} itens
            </h2>
          </div>
          <div className="divide-y">
            {items.map((item) => (
              <div key={item.id} className="px-4 py-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.description || item.expense_type}
                    </p>
                    <div className="flex gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500">
                        {item.expense_type}
                      </span>
                      {item.employees?.name && (
                        <span className="text-xs text-gray-500">
                          {item.employees.name.split(" ")[0]}
                        </span>
                      )}
                      {item.project_name && (
                        <span className="text-xs text-blue-600">
                          {item.project_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 ml-2">
                    {formatCurrency(item.value)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t bg-gray-50 flex justify-between">
            <span className="text-sm font-semibold text-gray-700">Total</span>
            <span className="text-sm font-bold text-gray-900">
              {formatCurrency(sheet.total_value || 0)}
            </span>
          </div>
        </div>

        {/* Approval history */}
        {sheet.approval_comments && sheet.approval_comments.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Histórico</h2>
            <div className="space-y-2">
              {sheet.approval_comments.map((c, idx) => (
                <div
                  key={idx}
                  className={`text-sm p-2 rounded ${
                    c.action === "aprovada" ? "bg-green-50" : "bg-amber-50"
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{c.by}</span>
                    <span className="text-xs text-gray-400">
                      {format(new Date(c.at), "dd/MM HH:mm")}
                    </span>
                  </div>
                  <p className="text-gray-600">
                    {c.action === "aprovada" ? "Aprovou" : "Questionou"}
                    {c.text ? `: ${c.text}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error banner (quando há erro mas a folha já carregou) */}
        {error && sheet && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Action buttons */}
        {!isAlreadyResolved && (
          <div className="bg-white rounded-lg shadow p-4 space-y-3">
            {showCommentBox && (
              <div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Escreva seu comentário..."
                  className="w-full border rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="flex-1 bg-green-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-50 active:bg-green-800 transition-colors"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                Aprovar
              </button>
              <button
                onClick={() => {
                  if (!showCommentBox) {
                    setShowCommentBox(true);
                  } else if (comment.trim()) {
                    handleQuestion();
                  }
                }}
                disabled={submitting || (showCommentBox && !comment.trim())}
                className="flex-1 bg-amber-500 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-amber-600 disabled:opacity-50 active:bg-amber-700 transition-colors"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageSquare className="w-5 h-5" />
                )}
                Questionar
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-center text-gray-400 pb-4">
          AG Topografia — Sistema de Gestão
        </p>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function friendlyErrorMessage(code?: string): string {
  switch (code) {
    case "NOT_FOUND":
      return "Folha de despesa não encontrada ou link inválido.";
    case "ALREADY_RESOLVED":
      return "Esta folha já foi resolvida. Atualize a página para ver o status.";
    case "COMMENT_REQUIRED":
      return "Para questionar, escreva um comentário.";
    case "INVALID_ACTION":
    case "MISSING_FIELDS":
    case "INVALID_JSON":
      return "Dados inválidos. Atualize a página e tente novamente.";
    case "DB_ERROR":
    case "DB_UPDATE_FAILED":
    case "SERVER_CONFIG_ERROR":
    default:
      return "Erro no servidor ao processar sua decisão. Tente novamente em instantes.";
  }
}
