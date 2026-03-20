import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, FileText, Image, Send, Loader2, Sparkles, MessageSquare, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AIResult {
  title?: string;
  service?: string;
  client_name?: string;
  location?: string;
  scope?: string;
  estimated_value?: number;
  estimated_duration?: string;
  payment_conditions?: string;
  technical_notes?: string;
  empresa_faturadora?: string;
  items?: { description: string; unit: string; quantity: number; unit_price: number; total_price: number }[];
  missing_info?: string[];
  confidence?: string;
  suggestions?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (data: AIResult) => void;
}

export default function PropostaAIDialog({ open, onOpenChange, onApply }: Props) {
  const [mode, setMode] = useState<"text" | "audio" | "image">("text");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);
  const [recording, setRecording] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleGenerate = async (inputPrompt?: string, inputMode?: string) => {
    const p = inputPrompt || prompt;
    if (!p.trim()) {
      toast.error("Digite ou grave uma descrição do serviço");
      return;
    }

    setLoading(true);
    setChatHistory((prev) => [...prev, { role: "user", content: p }]);

    try {
      const { data, error } = await supabase.functions.invoke("generate-proposal", {
        body: {
          prompt: p,
          mode: inputMode || (result ? "refine" : mode === "audio" ? "audio_transcript" : mode === "image" ? "image_description" : "text"),
          existingData: result || undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);
      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.suggestions || `Proposta gerada: ${data.title} — ${data.service} — ${data.estimated_value?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        },
      ]);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar proposta com IA");
    } finally {
      setLoading(false);
      setPrompt("");
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });

        // Use browser speech recognition as fallback
        toast.info("Processando áudio...");
        const recognition = new (window as any).webkitSpeechRecognition?.() || new (window as any).SpeechRecognition?.();
        if (!recognition) {
          toast.error("Reconhecimento de voz não suportado neste navegador. Use texto.");
          return;
        }
        recognition.lang = "pt-BR";
        recognition.continuous = false;
        recognition.interimResults = false;

        // Since we have the blob, we'll prompt the user to type what they said
        // The browser SpeechRecognition API works with live mic, not blobs
        toast.info("Áudio capturado. Use o modo texto para descrever o serviço ou tente novamente com o microfone ativo.");
      };

      mediaRecorder.start();
      setRecording(true);
      toast.info("🎙️ Gravando... Fale sobre o serviço desejado.");
    } catch {
      toast.error("Não foi possível acessar o microfone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  // Live speech recognition
  const startLiveSpeech = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Reconhecimento de voz não suportado. Use Chrome ou Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interim = transcript;
        }
      }
      setPrompt(finalTranscript + interim);
    };

    recognition.onend = () => {
      setRecording(false);
      if (finalTranscript.trim()) {
        handleGenerate(finalTranscript.trim(), "audio_transcript");
      }
    };

    recognition.onerror = (e: any) => {
      setRecording(false);
      if (e.error !== "no-speech") {
        toast.error("Erro no reconhecimento de voz: " + e.error);
      }
    };

    setRecording(true);
    recognition.start();
    toast.info("🎙️ Fale agora... Descreva o serviço desejado.");

    // Auto-stop after 30 seconds
    setTimeout(() => {
      if (recording) {
        recognition.stop();
      }
    }, 30000);

    mediaRecorderRef.current = { stop: () => recognition.stop() } as any;
  };

  const handleApply = () => {
    if (result) {
      onApply(result);
      onOpenChange(false);
      setResult(null);
      setChatHistory([]);
      toast.success("Dados da IA aplicados na proposta");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) { setResult(null); setChatHistory([]); }
      onOpenChange(v);
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-secondary" />
            Criar Proposta com IA
          </DialogTitle>
        </DialogHeader>

        {/* Mode selector */}
        <div className="flex gap-2 mb-4">
          <Button variant={mode === "text" ? "default" : "outline"} size="sm" onClick={() => setMode("text")}>
            <FileText className="w-4 h-4 mr-1" /> Texto
          </Button>
          <Button variant={mode === "audio" ? "default" : "outline"} size="sm" onClick={() => setMode("audio")}>
            <Mic className="w-4 h-4 mr-1" /> Áudio
          </Button>
          <Button variant={mode === "image" ? "default" : "outline"} size="sm" onClick={() => setMode("image")}>
            <Image className="w-4 h-4 mr-1" /> Print/Imagem
          </Button>
        </div>

        {/* Chat history */}
        {chatHistory.length > 0 && (
          <div className="space-y-2 mb-4 max-h-48 overflow-y-auto bg-muted/30 p-3 rounded-lg">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] p-2 rounded-lg text-sm ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="space-y-3">
          {mode === "text" && (
            <>
              <Label>Descreva o serviço desejado</Label>
              <Textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Preciso fazer um levantamento planialtimétrico de um terreno de 5 hectares em Campinas-SP para projeto de loteamento. O terreno tem relevo ondulado e vegetação rasteira. O cliente é a Construtora ABC."
              />
              <p className="text-xs text-muted-foreground">
                💡 Quanto mais detalhes, melhor a proposta gerada. Inclua: tipo de serviço, área, local, cliente, prazo desejado.
              </p>
            </>
          )}

          {mode === "audio" && (
            <div className="text-center py-6">
              <Button
                size="lg"
                variant={recording ? "destructive" : "default"}
                onClick={recording ? () => mediaRecorderRef.current?.stop() : startLiveSpeech}
                className="rounded-full w-20 h-20"
              >
                {recording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              </Button>
              <p className="mt-3 text-sm text-muted-foreground">
                {recording ? "🔴 Gravando... Clique para parar" : "Clique para gravar sua descrição"}
              </p>
              {prompt && (
                <div className="mt-3 text-left bg-muted p-3 rounded-lg">
                  <Label className="text-xs">Transcrição:</Label>
                  <p className="text-sm mt-1">{prompt}</p>
                </div>
              )}
            </div>
          )}

          {mode === "image" && (
            <>
              <Label>Descreva o conteúdo da imagem/print</Label>
              <Textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Cole aqui as informações extraídas do print, e-mail ou documento recebido do cliente..."
              />
              <p className="text-xs text-muted-foreground">
                📸 Copie o texto do print ou descreva o conteúdo da imagem recebida.
              </p>
            </>
          )}

          <div className="flex gap-2">
            <Button onClick={() => handleGenerate()} disabled={loading || (!prompt.trim() && mode !== "audio")} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              {result ? "Refinar Proposta" : "Gerar Proposta"}
            </Button>
          </div>
        </div>

        {/* Result preview */}
        {result && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-secondary" />
                Proposta Gerada
              </h3>
              <Badge variant="outline" className={
                result.confidence === "alta" ? "border-green-500 text-green-700" :
                result.confidence === "media" ? "border-amber-500 text-amber-700" :
                "border-red-500 text-red-700"
              }>
                Confiança: {result.confidence || "N/A"}
              </Badge>
            </div>

            <Card>
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="font-medium">Título:</span> {result.title}</div>
                  <div><span className="font-medium">Serviço:</span> {result.service}</div>
                  <div><span className="font-medium">Cliente:</span> {result.client_name || "—"}</div>
                  <div><span className="font-medium">Local:</span> {result.location || "—"}</div>
                  <div><span className="font-medium">Valor:</span> {result.estimated_value?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                  <div><span className="font-medium">Prazo:</span> {result.estimated_duration}</div>
                  <div className="col-span-2"><span className="font-medium">Pagamento:</span> {result.payment_conditions}</div>
                  <div className="col-span-2"><span className="font-medium">Escopo:</span> {result.scope}</div>
                </div>

                {result.items && result.items.length > 0 && (
                  <div className="mt-2">
                    <span className="font-medium">Itens:</span>
                    <div className="mt-1 space-y-1">
                      {result.items.map((item, i) => (
                        <div key={i} className="flex justify-between bg-muted/50 p-2 rounded text-xs">
                          <span>{item.description}</span>
                          <span>{item.quantity} {item.unit} × {item.unit_price?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} = {item.total_price?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {result.missing_info && result.missing_info.length > 0 && (
              <Card className="border-amber-300 bg-amber-50">
                <CardContent className="p-3">
                  <p className="font-medium text-sm flex items-center gap-1 text-amber-800">
                    <AlertTriangle className="w-4 h-4" /> Informações faltantes
                  </p>
                  <ul className="mt-1 text-xs text-amber-700 list-disc list-inside">
                    {result.missing_info.map((info, i) => <li key={i}>{info}</li>)}
                  </ul>
                  <p className="text-xs text-amber-600 mt-2">
                    <MessageSquare className="w-3 h-3 inline mr-1" />
                    Digite abaixo para fornecer mais detalhes e refinar a proposta.
                  </p>
                </CardContent>
              </Card>
            )}

            {result.suggestions && (
              <p className="text-xs text-muted-foreground italic">💡 {result.suggestions}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setResult(null); setChatHistory([]); }}>
                Recomeçar
              </Button>
              <Button onClick={handleApply} className="bg-secondary hover:bg-secondary/90">
                ✅ Usar esta Proposta
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
