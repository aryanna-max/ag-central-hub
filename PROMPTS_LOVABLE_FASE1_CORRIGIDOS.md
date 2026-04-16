# FASE 1 — PROMPTS LOVABLE (CORRIGIDOS 15/04/2026)

Baseado no diagnóstico real do banco:
- project_benefits usa `almoco_type` (text: va_cobre/diferenca/integral), NÃO `almoco_diferenca_enabled`
- project_benefits NÃO tem campos vt, carro, fd
- attendance_status enum: presente, falta, justificado, atrasado
- daily_schedule_entries tem: employee_id, project_id, vehicle_id, attendance
- NENHUMA escala foi fechada ainda (is_closed = false em todas)
- 22 projetos ativos, ZERO com benefícios configurados

---

## L1 — Tela de Benefícios por Projeto

> Executar APÓS SQL S1. Confirmar build antes de L2.

```
No módulo Campo/Operacional, na página de detalhe do projeto, 
adicionar uma nova aba "Benefícios" nas tabs existentes.

A aba deve usar a tabela project_benefits que JÁ EXISTE no banco 
com estes campos exatos:
- cafe_enabled (boolean)
- cafe_value (numeric)
- almoco_type (text: 'va_cobre' | 'diferenca' | 'integral')
- almoco_diferenca_value (numeric) — só aparece se almoco_type = 'diferenca'
- jantar_enabled (boolean)
- jantar_value (numeric)
- hospedagem_enabled (boolean)
- hospedagem_type (text: 'pousada' | 'casa_alugada' | 'hotel')
- hospedagem_value (numeric)
- pagamento_antecipado (boolean)
- dia_pagamento (text: 'segunda'|'terca'|'quarta'|'quinta'|'sexta'|'retroativo')

Comportamento:
1. Ao abrir a aba, buscar project_benefits WHERE project_id = projeto atual
2. Se não existir registro, mostrar formulário vazio com defaults
3. Formulário editável com:
   - Card "Café": Switch cafe_enabled + Input cafe_value (R$, só aparece se enabled)
   - Card "Almoço": Select almoco_type (3 opções) + Input almoco_diferenca_value 
     (só aparece se tipo = 'diferenca')
   - Card "Jantar": Switch jantar_enabled + Input jantar_value (R$)
   - Card "Hospedagem": Switch hospedagem_enabled + Select hospedagem_type + 
     Input hospedagem_value (R$)
   - Card "Pagamento": Switch pagamento_antecipado + Select dia_pagamento
4. Botão "Salvar" faz UPSERT (insert on conflict project_id do update)
5. Toast de sucesso: "Benefícios salvos"

Visual: usar Cards do ShadcnUI com Switch e Input. Layout em grid 2 colunas.
Apenas roles operacional e diretor podem editar.

NÃO criar tabela nova — usar project_benefits existente.
NÃO modificar nenhum outro arquivo.
```

---

## L2 — Fechar Escala → Gerar RDF Automático

> Executar APÓS L1 confirmado. Esta é a peça central.

```
No hook que gerencia o fechamento da escala diária 
(src/hooks/useDailySchedule.ts ou arquivo equivalente que contém 
a lógica de is_closed), APÓS a lógica existente de fechamento, 
adicionar geração automática de employee_daily_records.

Lógica ao fechar escala (quando is_closed muda para true):
1. Buscar todos daily_schedule_entries do dia WHERE 
   daily_schedule_id = schedule.id AND attendance = 'presente'
2. Para cada entry com attendance = 'presente':
   a. Buscar project_benefits WHERE project_id = entry.project_id
   b. Se project_benefits existe, criar employee_daily_record com:
      - employee_id: entry.employee_id
      - date: schedule.schedule_date
      - project_id: entry.project_id
      - schedule_entry_id: entry.id
      - cafe_enabled: pb.cafe_enabled
      - cafe_value: pb.cafe_value
      - almoco_type: pb.almoco_type
      - almoco_diferenca_value: pb.almoco_diferenca_value
      - jantar_enabled: pb.jantar_enabled
      - jantar_value: pb.jantar_value
      - hospedagem_enabled: pb.hospedagem_enabled
      - hospedagem_type: pb.hospedagem_type
      - hospedagem_value: pb.hospedagem_value
      - usou_veiculo: entry.vehicle_id IS NOT NULL
      - vehicle_id: entry.vehicle_id
      - pagamento_antecipado: pb.pagamento_antecipado
      - dia_pagamento: pb.dia_pagamento
      - total_beneficios: soma dos valores enabled
      - source: 'escala'
   c. Se project_benefits NÃO existe, criar com valores zerados e 
      cafe_enabled/jantar_enabled = false
3. Usar UPSERT (on conflict employee_id, date → do update) para 
   não duplicar se fechar novamente
4. Calcular total_beneficios como:
   (cafe_enabled ? cafe_value : 0) + 
   (almoco_type = 'diferenca' ? almoco_diferenca_value : 0) + 
   (jantar_enabled ? jantar_value : 0) + 
   (hospedagem_enabled ? hospedagem_value : 0)
5. Mostrar toast: "RDF gerado: X funcionários registrados"
6. Se algum projeto não tem benefícios configurados, mostrar 
   warning toast: "Atenção: projeto [nome] sem benefícios configurados"

Tabela employee_daily_records já foi criada no banco via SQL S1.

NÃO alterar a lógica existente de fechamento.
NÃO alterar a lógica de vehicle_payment_history.
NÃO modificar nenhum outro hook ou página.
```

---

## L3 — Tela RDF Digital

> Executar APÓS L2 confirmado.

```
Criar nova página src/pages/operacional/RDFDigital.tsx.

Funcionalidade:
1. Filtros no topo:
   - Mês/Ano: seletor (default = mês atual)
   - Funcionário: Combobox com busca (lista de employees ativos)
2. Ao selecionar funcionário + mês:
   - Buscar employee_daily_records WHERE employee_id = selecionado
     AND date >= primeiro dia do mês AND date <= ultimo dia do mês
   - Ordenar por date ASC
3. Tabela com colunas:
   DIA | PROJETO | CAFÉ | ALM.DIF | JANTAR | HOSP | VEÍCULO | TOTAL
4. Cada linha = 1 dia do mês
   - Dias com registro: mostrar valores. Café R$8,00 se enabled, "—" se não
   - Dias sem registro: linha cinza vazia
   - Projeto: mostrar nome do projeto com badge colorido
   - Veículo: mostrar "Sim" se usou_veiculo = true
5. Rodapé: linha de TOTAIS somando cada coluna numérica
6. Botão "Exportar CSV" no topo direito
7. Somente leitura — dados vêm do fechamento da escala
8. Se nenhum registro no mês:
   "Nenhum registro encontrado. Os dados são gerados 
   automaticamente ao fechar a escala diária."

Rota: /operacional/rdf
Sidebar: adicionar item "RDF" com ícone Receipt no módulo operacional,
após o item de Escala.

NÃO modificar nenhuma página existente.
NÃO criar tabela nova.
```

---

## L4 — Botão "Gerar da Escala" nas Despesas

> Executar APÓS L3 confirmado.

```
Na página de despesas de campo (field_expense_sheets) do módulo 
Campo/Operacional, adicionar botão "Gerar da Escala" no topo 
da lista, ao lado do botão existente de criar nova folha.

Ao clicar:
1. Abrir modal com:
   - Seletor de semana (segunda a domingo, date picker)
   - Preview: mostrar quantos employee_daily_records existem 
     nessa semana
2. Ao confirmar:
   a. Buscar employee_daily_records WHERE date BETWEEN segunda AND domingo
   b. Agrupar por employee_id
   c. Para cada funcionário, criar um field_expense_item com:
      - employee_id: do agrupamento
      - project_id: do primeiro registro (ou null se múltiplos projetos)
      - expense_type: 'beneficios_campo'
      - nature: 'operacional'
      - item_type: 'beneficio'
      - description: "Benefícios semana [dd/mm] - [nome funcionário]"
      - value: soma dos total_beneficios dos dias
      - payment_method: 'dinheiro'
      - payment_status: 'pendente'
   d. Criar field_expense_sheet com:
      - period_start: segunda
      - period_end: domingo
      - week_number: número da semana
      - week_year: ano
      - week_label: "Semana [N] - [Mês/Ano]"
      - status: 'rascunho'
      - total_value: soma de todos os items
   e. Redirecionar para a folha criada em modo edição
3. Se já existir folha para essa semana (mesmo period_start), 
   mostrar aviso e não duplicar
4. Toast: "Folha semanal criada com X itens"

NÃO alterar o workflow de aprovação existente.
NÃO modificar nenhum outro arquivo.
```

---

## ORDEM DE EXECUÇÃO

1. ✅ SQL S1-0 (handle_updated_at)
2. ✅ SQL S1-A (employee_daily_records)  
3. ✅ SQL S1-B (benefit_settlements)
4. ✅ SQL S1-C (verificação)
5. L1 → confirmar build
6. L2 → confirmar build → testar com escala real
7. L3 → confirmar build
8. L4 → confirmar build

## ATENÇÃO SOBRE ESCALAS

O diagnóstico mostrou que NENHUMA escala foi fechada (is_closed = false).
Isso significa que Marcelo pode não estar usando o botão "Fechar Escala".
Antes de testar L2, confirmar com Marcelo se ele usa essa função.
Se não usa, precisamos entender o fluxo real dele antes de automatizar.
