import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Check } from "lucide-react";
import loginBg from "@/assets/login-bg.jpg";
import logoAg from "@/assets/logo-ag.png";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const verifyRecoverySession = async () => {
      const hash = window.location.hash;
      const hasRecoveryHash = hash.includes("type=recovery") || hash.includes("access_token=");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session) {
        setReady(true);
        return;
      }

      if (!hasRecoveryHash) {
        setError("Link de recuperação inválido ou expirado.");
        return;
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, sessionData) => {
        if (!mounted) return;
        if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && sessionData) {
          setReady(true);
          setError("");
          subscription.unsubscribe();
        }
      });

      setTimeout(async () => {
        const {
          data: { session: delayedSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (delayedSession) {
          setReady(true);
          setError("");
        } else {
          setError("Link de recuperação inválido ou expirado.");
        }

        subscription.unsubscribe();
      }, 1200);
    };

    verifyRecoverySession();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ready) {
      setError("Aguardando validação do link de recuperação.");
      return;
    }

    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setError("");
    setLoading(true);

    const { error: err } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (err) {
      setError(err.message || "Erro ao alterar senha. O link pode ter expirado.");
      return;
    }

    setSuccess(true);
    setTimeout(() => navigate("/login"), 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <img src={loginBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(200,30%,12%)]/80 to-[hsl(199,65%,30%)]/60" />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 p-8 space-y-6">
          <div className="flex flex-col items-center gap-3">
            <img src={logoAg} alt="AG Topografia e Construções" className="h-24 w-auto" />
            <h1 className="text-lg font-semibold text-foreground">Redefinir Senha</h1>
          </div>

          {success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-secondary" />
              </div>
              <p className="text-sm text-muted-foreground">Senha alterada com sucesso! Redirecionando...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {!ready && !error && (
                <p className="text-sm text-muted-foreground text-center">Validando link de recuperação...</p>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={!ready || loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    disabled={!ready || loading}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar Senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  disabled={!ready || loading}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={!ready || loading}>
                {loading ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
