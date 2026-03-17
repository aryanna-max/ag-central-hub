

## Plano de Implementação

### 1. Pré-preencher veículo padrão ao selecionar equipe

**Escala Mensal (`EscalaMensal.tsx`):** Quando o usuário selecionar uma equipe no formulário de nova alocação, buscar o `default_vehicle_id` da equipe (já disponível nos dados de `useTeams`) e preencher automaticamente o campo veículo.

**Escala Diária (`EscalaDiaria.tsx`):** Mesma lógica no formulário de adicionar equipe -- ao selecionar a equipe, pré-preencher o veículo padrão.

### 2. Corrigir sincronização Mensal → Diária

Dois problemas identificados no `usePreFillFromMonthly`:

- **Não filtra por data:** Busca todas as alocações do mês, mas não verifica se a data do dia está dentro do intervalo `start_date`/`end_date` da alocação.
- **Não inclui `vehicle_id`:** Ao criar `daily_team_assignments` e `daily_schedule_entries`, o campo `vehicle_id` da escala mensal não é repassado.
- **Não respeita `schedule_type`:** Se o tipo é "mensal", sábados e domingos deveriam ser excluídos.

**Correção:** Reescrever `usePreFillFromMonthly` para filtrar alocações pelo intervalo de datas, incluir `vehicle_id`, e respeitar o tipo de escala.

Além disso, o `useCreateMonthlySchedule` deveria opcionalmente criar/atualizar as escalas diárias já existentes no período (sync forward).

### 3. DreamSat II (dreamsat2.com.br) -- Rastreamento GPS

O site DreamSat II é uma plataforma de rastreamento veicular que requer login (usuário/senha). **Não é possível integrar diretamente** porque:

- É um sistema fechado com autenticação proprietária
- Não possui API pública documentada
- Não há conector disponível para esse serviço

**Alternativas viáveis:**
- Verificar com a DreamSat se oferecem API de integração (muitas plataformas de rastreamento oferecem APIs REST mediante contrato)
- Se houver API disponível, criar uma Edge Function que consulta a posição dos veículos e exibe no mapa
- Enquanto isso, adicionar um campo `tracker_url` na tabela `vehicles` para armazenar um link direto do DreamSat para cada veículo, permitindo acesso rápido

### Resumo das alterações

| Arquivo | Mudança |
|---------|---------|
| `EscalaMensal.tsx` | Auto-preencher veículo ao selecionar equipe |
| `EscalaDiaria.tsx` | Auto-preencher veículo ao selecionar equipe |
| `useDailySchedule.ts` → `usePreFillFromMonthly` | Filtrar por intervalo de datas, incluir vehicle_id, respeitar schedule_type |
| `useMonthlySchedules.ts` → `useCreateMonthlySchedule` | Após criar alocação mensal, sincronizar com escalas diárias abertas existentes |

