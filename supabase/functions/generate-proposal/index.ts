import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SERVICES_CONTEXT = `
Serviços de topografia e cartografia oferecidos pela AG Topografia e AG Cartografia:

LEVANTAMENTOS:
- Levantamento Planimétrico: R$3.000-15.000 (depende da área)
- Levantamento Altimétrico: R$3.500-18.000
- Levantamento Planialtimétrico: R$5.000-25.000
- Levantamento Cadastral Urbano: R$4.000-20.000
- Levantamento Cadastral Rural: R$5.000-30.000
- Levantamento para Projeto de Engenharia: R$8.000-40.000
- Levantamento Batimétrico: R$10.000-50.000
- Levantamento com Drone/VANT: R$5.000-25.000
- Escaneamento Laser 3D: R$15.000-80.000

GEORREFERENCIAMENTO E REGULARIZAÇÃO:
- Georreferenciamento INCRA: R$5.000-25.000
- Desmembramento de Área: R$3.000-12.000
- Remembramento de Área: R$3.000-12.000
- Usucapião: R$4.000-15.000
- Retificação em Cartório: R$3.500-10.000

OBRAS E ACOMPANHAMENTO:
- Locação de Obra: R$3.000-15.000
- Controle de Terraplenagem: R$8.000-40.000 (mensal)
- As-built: R$5.000-25.000
- Acompanhamento de Obras: R$10.000-50.000 (mensal)
- Topografia Industrial: R$8.000-35.000

OUTROS:
- Supervisão Técnica: R$5.000-20.000 (mensal)
- Projeto de Loteamento: R$20.000-100.000

Fatores que influenciam o preço: área do terreno, complexidade do relevo, localização/deslocamento, urgência, quantidade de pontos/marcos, tipo de vegetação.

Empresas faturadoras: AG Topografia (padrão) ou AG Cartografia.
Condições de pagamento comuns: 50% na contratação + 50% na entrega, ou 30/40/30.
Prazos típicos: 5 a 60 dias úteis dependendo do serviço.
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, mode, existingData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let userMessage = "";

    if (mode === "audio_transcript") {
      userMessage = `O usuário gravou um áudio descrevendo um serviço. A transcrição é:
"${prompt}"

Analise e extraia todas as informações para montar uma proposta comercial.`;
    } else if (mode === "image_description") {
      userMessage = `O usuário enviou uma imagem/print com informações sobre um serviço. A descrição extraída é:
"${prompt}"

Analise e extraia todas as informações para montar uma proposta comercial.`;
    } else if (mode === "refine") {
      userMessage = `O usuário tem uma proposta parcialmente preenchida e quer refinar/completar. Dados atuais:
${JSON.stringify(existingData, null, 2)}

Instrução do usuário: "${prompt}"

Atualize os campos conforme solicitado e preencha campos vazios com sugestões inteligentes.`;
    } else {
      userMessage = `O usuário descreveu um serviço em texto livre:
"${prompt}"

Analise e extraia todas as informações para montar uma proposta comercial.`;
    }

    const systemPrompt = `Você é um assistente especialista em topografia e cartografia da AG Topografia/AG Cartografia.
Sua função é gerar propostas comerciais estruturadas com base em informações fornecidas pelo usuário.

${SERVICES_CONTEXT}

REGRAS:
1. Sempre sugira valores baseados nas faixas de mercado acima
2. Se informações estiverem faltando, preencha com sugestões razoáveis e marque com [SUGESTÃO]
3. Identifique o serviço mais adequado com base na descrição
4. Sugira prazos realistas
5. Responda APENAS com o JSON estruturado, sem texto adicional

RESPONDA EXCLUSIVAMENTE com um JSON no seguinte formato:
{
  "title": "Título da proposta",
  "service": "Nome do serviço (da lista acima)",
  "client_name": "Nome do cliente (se mencionado) ou null",
  "location": "Local da obra/serviço ou null",
  "scope": "Descrição detalhada do escopo do serviço",
  "estimated_value": 0,
  "estimated_duration": "X dias úteis",
  "payment_conditions": "Condições de pagamento sugeridas",
  "technical_notes": "Observações técnicas relevantes",
  "empresa_faturadora": "ag_topografia",
  "items": [
    {
      "description": "Descrição do item",
      "unit": "un/m²/km/ha/mês",
      "quantity": 1,
      "unit_price": 0,
      "total_price": 0
    }
  ],
  "missing_info": ["lista de informações que faltam para completar a proposta"],
  "confidence": "alta/media/baixa",
  "suggestions": "Sugestões adicionais para o usuário"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos na configuração do workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erro no serviço de IA");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle markdown code blocks)
    let parsed;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsed = JSON.parse(jsonMatch[1]!.trim());
    } catch {
      parsed = { error: "Não foi possível interpretar a resposta da IA", raw: content };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-proposal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
