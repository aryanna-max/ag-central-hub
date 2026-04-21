# Sessão 20051cb3 — system-diagnostic-cleanup (15/04/2026)

**Classificação:** 🟡 ALTO VALOR — auditoria operacional profunda + recuperação de conexões perdidas. Base do que virou `_OBJETIVO.md` e ADR Responsabilidades.

**Origem:** `claude --teleport` a partir da branch `claude/system-diagnostic-cleanup-qtcz8` (1 commit órfão: restaurar DashboardOperacional + deletar ARCHITECTURE.md). Sessão anterior (`session_01SoCXpFrE5W...`) não recuperável — contexto foi reconstruído por arqueologia de git e análise de planilhas.

**Sessão 4b4488f1 é continuação desta** (+89 linhas no fim sobre cleanup V2/V3).

---

## Decisões tomadas

1. **Merge da branch `cleanup-qtcz8` no main** (feito + push) — contribuía apenas DashboardOperacional restaurado.
2. **BRK é exceção, não padrão** — licitação pública, SERTRAS, NR-18, regras que só Alcione conhece. Arquitetura de compliance deve ser **leve por padrão** com configuração extra por cliente, nunca forçar os 48 clientes simples a workflow complexo. (Hoje BRK = 39% da receita.)
3. **Sistema desenhado por CARGO (raias BPMN), não por pessoa** — permite delegar e contratar. Hoje Alcione ocupa 3 raias (Analista RH, Almoxarife, Supervisor Fin), Marcelo ocupa 2.
4. **Almoxarife = Alexandre** (mat 000116), não Alcione. Supervisor Adm/Fin ainda indefinido (Alcione ou Aryanna).
5. **Aryanna = Diretora construindo a infraestrutura** — role `master`, par com Sérgio/Ciro mas foco em estrutura organizacional, não comercial/técnico.
6. **Cliente como HUB central** — cada módulo é camada de visualização do mesmo cliente (Negócios/Campo/Prancheta/Faturamento/Documentos/Integrações/Emails/Alertas). Base do que virou decisão 07/04 "Cliente como centro".
7. **Claude Code é para IMPLEMENTAR, não planejar** — arquitetura/diagnóstico deve ser feito fora; CLAUDE.md é o contrato entre sessões.
8. **Descartar V3** e manter V2 puro (arquitetura sem considerar código existente) — decisão polêmica no fim da sessão.
9. **Benefícios de funcionários SÃO custos do projeto** — não existem dois sistemas. `field_expense_sheets` + `field_expense_items` já está estruturado corretamente para isso.

---

## Raciocínios técnicos — modelo operacional real

### RDF (Relação de Despesas por Funcionário) — peça central
49 abas (1 por funcionário), dia a dia: `OBRA | CAFÉ | ALMOÇO | JANTA | VT | CARRO | FD`. Totais + Recebido + Saldo. **O que o sistema deveria gerar automaticamente ao fechar a escala diária** cruzando com `project_benefits`.

### Caixa do Marcelo — folha semanal unificada
29 folhas em 2026, numeração `NNN/26`. Colunas: COLABORADOR, CAFÉ, ALMOÇO, JANTAR, TRANSPORTE, DIÁRIA, COMBUSTÍVEL, OUTROS, DESCONTO, TOTAL, DESCRIÇÃO (com PROJETO entre parênteses), CONTAS (forma pagto). Inclui funcionários, terceiros (hotel, locadora, prestador), pode ter múltiplas folhas simultâneas.

### Benefícios — modelo correto
- Funcionários recebem **SALÁRIO** fixo mensal CLT — "diária" nunca é pagamento de funcionário.
- "Diária" = veículos, tipos de serviço, medições.
- **Alelo** (R$15/dia, 20 dias úteis = R$300/mês) cobre almoço padrão → desconto apenas mensal (relatório → Alcione → contador).
- **Diferença de almoço** = complemento **semanal** em projetos com almoço mais caro (ex: Porto de Pedra R$13/dia × 5 = R$65/sem).
- **Café, Jantar** = semanais, só onde projeto dá direito.
- **VT** = mensal, "não creditar" para campo distante.

### Encontro de contas (semanal)
Adiantamento pago semana anterior → se faltou ou mudou projeto → desconto na próxima folha (café, dif. almoço, jantar). Alelo/VT ficam apenas no relatório mensal para contador.

### Fluxo correto ao fechar escala diária
```
Escala fechada → 
  ✅ Gera diária de veículo (já faz)
  ✅ Registra presença funcionário
  ✅ Gera item de despesa rascunho baseado em project_benefits
  ✅ Incrementa dias trabalhados no projeto (base da medição)
  ✅ Alimenta relatório mensal (Alelo/VT)
  ✅ Gera alertas de divergência
```

### Folha de pagamento — 3 bancos, 2 empresas
- Gonzaga e Berlim (Bradesco, Simples 22,5%)
- AG Cartografia (BB, Simples 16,5%)
- AG Topografia Avulsa
- Janeiro/26: R$103k total (Bradesco R$49,5k + BB R$53,5k + PJ R$14,7k)

### Emails — 5 contas, fluxo quebrado
| Conta | Função | Gap |
|---|---|---|
| aryanna@ | Master | — |
| operacional@ | Campo+ST | NFs chegam aqui em vez do financeiro |
| financeiro@ | Faturamento | — |
| comercial@ | Contratos, BRK OS | — |
| alcionesantos@ | Pessoal Alcione | ASOs e tratativas documentais vão aqui, não no sistema |

---

## Bugs / problemas diagnosticados

1. **`field_payments` + `field_payment_items` + `benefit_rules` foram REMOVIDOS** — hook `useFieldPayments.ts`, drawer `DespesaCampoDrawer`, detail `DespesaCampoDetail` deletados. Rebuild de 20/03 (`85cd923`) fundiu no `field_expense_sheets` perdendo o conceito de benefício.
2. **`project_benefits` órfã** — tabela existe no banco, UI mostra checkboxes em `EscalaDiaria.tsx` mas não persiste em lugar nenhum (estado local que some).
3. **Escala fechada NÃO gera despesa** — Marcelo preenche tudo manual.
4. **Zero link escala × despesa × medição** — impossível responder "pagou diária sem escalar?".
5. **Arquivos órfãos em `/operacional/`:** `Medicoes.tsx` (206 linhas, sem rota), `Ferias.tsx` (327 linhas, deveria ser RH), `Relatorios.tsx` (stub 17 linhas).
6. **Discrepâncias CLAUDE.md v9 vs realidade:** F-FIN marcado "PARADO" mas estava implementado com 20 commits no dia; "sem commits desde 09/04" falso.
7. **Processos BPMN não entregues** (consultoria Bizagi): Escala de Campo (CRÍTICO), Admissão, Desligamento, Manutenção/Calibração, Marketing, Gestão Qualidade.
8. **Contratos.xlsx da Alcione é esqueleto** — só nome + funcionários alocados; sem valor, vigência, escopo, vencimento.
9. **PCMSO vencido** (vigência 07/2023).
10. **NR-18 vencendo**: Jefferson, Richard, Rodrigo.
11. **Planilhas estáticas por contrato** — quando Marcelo troca funcionário de projeto, Alcione não é notificada para integrar/desintegrar nos portais.
12. **Sala Técnica: zero rastreio** — 18.115 arquivos em abril, 61 pastas, mas quem processou o quê, status de entrega, revisão, escopo contratado vs entregue → tudo na cabeça do Emanuel.

---

## Pendências

- Conectar `project_benefits` à UI/fluxo.
- Conectar escala → rascunho de folha semanal com encontro de contas automático.
- Relatório mensal de descontos (Alelo + VT) gerado da escala fechada para Alcione → contador.
- Tabelas novas: `employee_documents`, `client_integration_requirements`, `employee_client_integrations`, calendário compliance mensal.
- Limpar órfãos do Operacional (mover Ferias, decidir sobre Medicoes, deletar Relatorios stub).
- Atualizar CLAUDE.md para refletir F-FIN feito.
- Definir função de Aryanna e do Supervisor Adm/Fin olhando processos BPMN.

---

## Arquivos/entidades referenciados

- `src/pages/operacional/{Medicoes,Ferias,Relatorios,EscalaDiaria,DespesasDeCampo}.tsx`
- `src/hooks/useCloseDailySchedule` — hub central subutilizado
- Tabelas: `daily_schedules`, `daily_schedule_entries`, `field_expense_sheets`, `field_expense_items`, `project_benefits` (órfã), `vehicle_payment_history`, `field_payments` (removida), `field_payment_items` (removida), `benefit_rules` (removida)
- Commits-chave: `42922a5` (criação 19/03), `85cd923` (rebuild 20/03), `23db64d` (refactor 20/03), `8e0636a` (remove confirmação 03/04), `70c1274` (diárias veículos auto 03/04), `cfcd5ed` (redesign operacional 07/04), `d8ca1ce` (field_payments criado e depois perdido), `af5ff73` (último commit com `useFieldPayments.ts`)
- `C:\Users\aryan\Documents\Claude\Projects\Sistema AG\ARQUIVOS MARCELO\` (CAIXA, RDF, ESCALA, ABASTECIMENTO, HORAS EXTRAS, MEDIÇÕES, FATURAMENTO)
- `C:\Users\aryan\Documents\Claude\Projects\Sistema AG\ARQUIVOS ALCIONE\` (Alelo, VEM, Descontos, Contratos, SST, ATIVIDADES DO MÊS)
- `C:\Users\aryan\Documents\Claude\Projects\AG Topografia - Central\PROCESSOS CONSULTORIA BIZAGI\` (10 BPMN)
- Arquivos gerados na sessão (depois descartados em parte): `ARQUITETURA_SISTEMA_V2_15ABR2026.html`, `ARQUITETURA_SISTEMA_V3_15ABR2026.html`, `ARQUITETURA_CONSOLIDADA_AG.md`, `ARQUITETURA_CONSOLIDADA_AG_15ABR2026.html`, `PROMPT_COWORK_AG.md`

---

## Trechos-chave

> "funcionarios recebem salario, nao diarias, diarias sao situações exporadicas. esse termo é utilizado para tipos de servioç e medições e carros, ausencias de funcionarios geram descontos que podem ser entre semanas se foram benefecios ou mensais"

> "nas folhas semanais, beneficios de funcionarios sao custos do projeto."

> "BRK É DIFERENTE DE TUDO, SÓ TEMOS UMA EMPRESA NESSES MOLDES, NAO TOMAR COMO PADRAO, ELA É UMA EMPRESA QUE VEIO DE LICITAÇAO E TEM SUAS PROPRIAS REGRAS QUE SÓ ALCIONE SABE TB."

> "SE ALCIONE FALTAR, NINGUEM SABE O QUE FAZER PQ NAO TENHO NENHUMA INFORMAÇÃO DE NADA" — risco operacional central; toda inteligência documental está na cabeça dela.

> "ESTAMOS TRATANDO PELOS NOMES MAS DEVES SER TRATADOS POR CARGO... MARCELO FICA SOBRECARREGADO PORQUE ESTÁ DESENHADO DE UM JEITO QUE NAO TENHO NEM COMO COLOCAR UMA PESSOA PARA FAZER DETERMINADAS FUNÇÕES JA QUE NADA EXISTE EM CONSOLIDADO, TUDO ESTÁ ESPALHADO"

> "NAO QUERO V3, QUERO O QUE CONVERSAMOS ATÉ V2, A PRIMEIRA ARQUITETURA CRIADA NESSE CHAT, V3 LEVOU EM CONSIDERAÇÃO O QUE EXISTIA E NAO QUERO CONSIDERAR ESSA INFORMACAO AGORA"
