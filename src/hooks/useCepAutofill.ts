import { useState, useEffect, useRef } from "react";

interface CepResult {
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
  loading: boolean;
  error: string | null;
}

export function useCepAutofill(cep: string): CepResult {
  const [result, setResult] = useState<CepResult>({ rua: "", bairro: "", cidade: "", estado: "", loading: false, error: null });
  const lastFetched = useRef("");

  useEffect(() => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8 || digits === lastFetched.current) return;
    lastFetched.current = digits;

    const controller = new AbortController();
    setResult(prev => ({ ...prev, loading: true, error: null }));

    fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data.erro) {
          setResult(prev => ({ ...prev, loading: false, error: "CEP não encontrado" }));
        } else {
          setResult({
            rua: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            estado: data.uf || "",
            loading: false,
            error: null,
          });
        }
      })
      .catch(err => {
        if (err.name !== "AbortError") {
          setResult(prev => ({ ...prev, loading: false, error: "Erro ao buscar CEP" }));
        }
      });

    return () => controller.abort();
  }, [cep]);

  return result;
}
