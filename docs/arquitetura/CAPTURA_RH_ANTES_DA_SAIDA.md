# CAPTURA — o que a pessoa de RH faz hoje (antes de sair)

**Data:** 11/08/2026
**Por quê:** a pessoa que hoje acumula duas funções em RH está de saída. O conhecimento operacional dela é tácito — mora na cabeça e em planilhas, não no Átina. Se sair sem captura, as ferramentas de RH da Onda 3 nascem incompletas e a operação trava. **Este documento é a entrevista/inventário a rodar COM ela enquanto ainda está — o output vira requisito do ADR-045 (RH Onda 3).**
**Como usar:** sentar com ela (1–2 sessões), passar seção por seção, preencher as respostas em texto simples. Não precisa ser bonito; precisa ser completo. Onde ela disser "depende", **capturar do que depende** — é aí que está o conhecimento que se perde.
**Regra de ouro da captura:** toda vez que ela abrir uma planilha, um site ou um WhatsApp para fazer algo, isso é um passo a registrar (fonte, quem recebe, prazo).

---

## 0. As duas funções

1. Quais são, no nome dela, as **duas funções** que acumula? (ex.: "RH/departamento pessoal" + "?")
2. Onde uma acaba e a outra começa? O que se confunde entre elas?
3. Se só desse para salvar **uma** das duas antes de ela sair, qual é a mais crítica e por quê?

---

## 1. Cadência mensal — o que acontece todo mês, em ordem de data

Preencher como um calendário do mês (dia → tarefa → fonte → para quem vai):

### 1.1 Folha (`payroll_periods`)
- Em que dia do mês começa a fechar a folha? Qual o prazo final?
- De onde vêm os números? (planilha? qual? quem preenche antes?)
- O que entra: salário base, descontos, benefícios, faltas, horas — liste **cada rubrica** e de onde ela sai.
- Quem confere? Quem aprova? Para quem vai o resultado (contador? banco? Alcione?)
- O que costuma dar errado / atrasar?

### 1.2 Benefícios (`benefit_settlements`, `project_benefits`)
- **Alelo** e **VEM** (vale-transporte): como recarrega? Site, valor por pessoa, prazo, quem paga?
- Como decide o valor de cada um por funcionário? (dias trabalhados? escala? projeto?)
- Existe acerto/desconto de benefício (café, almoço, jantar previsto × realizado)? Como calcula?
- Onde isso é anotado hoje, fora do Átina?

### 1.3 Escala (`daily_schedules`, `monthly_schedules`, `daily_schedule_entries`)
- Quem monta a escala? Com que antecedência? Onde (planilha? Átina?)
- Como a escala vira benefício e folha (dias em campo → diária/benefício)?
- Reserva AG, folga, falta, atestado — como marca e o que cada um afeta?

---

## 2. Por evento — o que acontece quando algo muda

### 2.1 Admissão
- Passo a passo de admitir alguém: documentos exigidos, ASO admissional, cadastro em quê, prazos legais.
- Em quais sistemas/portais cadastra? (Holmes, Certronic, Alldocs, cliente?)

### 2.2 Desligamento
- Passo a passo de desligar: rescisão, exame demissional, baixa em portais, devolução de EPI/crachá.
- Prazos que **não podem** ser perdidos (multa/risco)?

### 2.3 Exames ocupacionais / ASO (`employee_documents`, tipos `aso`, `pcmso`, `pgr`, `nr*`)
- Como sabe que um ASO/NR está vencendo? (planilha de controle? memória?)
- Qual clínica, qual custo, quanto tempo antes agenda?
- Quais clientes exigem qual documento de qual funcionário? (cruzamento cliente × funcionário)

### 2.4 Ausências e férias (`employee_vacations`, ausências)
- Como registra férias/ausência? O que isso dispara (folha, escala, benefício)?

---

## 3. Onde a verdade mora hoje (o que precisa entrar no Átina)

- Liste **todas as planilhas** de RH que ela usa: nome, o que guarda, quem mais mexe.
- Liste **todos os portais/sites** externos: qual, para quê, login de quem.
- Liste os **controles que só existem na cabeça dela** (prazos, "esse cliente é chato com X", "esse funcionário tem tal particularidade").

---

## 4. Decisões de julgamento (o conhecimento tácito — o mais importante)

Estas são as que se perdem com a saída. Para cada uma: **qual a regra que ela usa, mesmo que nunca tenha sido escrita?**
- Quando um valor "não bate", como decide o que está certo?
- Que exceções ela trata caso a caso? (funcionário X, cliente Y)
- O que ela verifica "no olho" antes de dar algo por concluído?
- Que erro já aconteceu no passado que ela hoje previne sem pensar?

---

## 5. Fechamento
- Se ela fosse treinar o substituto em 1 hora, o que diria primeiro?
- Qual a coisa que, se o sistema fizesse sozinho, mais aliviaria o dia dela?
- O que ela **não** confiaria a um sistema/agente tão cedo, e por quê?

---

> **Saída deste documento →** vira a §"operação real" do **ADR-045 (RH Onda 3)**: cada passo com fonte/prazo/destinatário é candidato a ferramenta (passa pelo gate Engine vs. CRUD). Sem esta captura, o ADR não tem lastro.
