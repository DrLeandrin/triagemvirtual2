# ROADMAP — Triagem Virtual v1

## Milestone: v1 — MVP Completo

Fluxo end-to-end: Paciente conversa com agente AI por voz → AI gera resumo clínico → Médico revisa e contata paciente.

---

## Fase 1: Fundação — Banco de Dados, Auth e Layout Base
**Objetivo**: Infraestrutura base funcionando — Supabase configurado, autenticação de pacientes e médicos, layout base da aplicação.

**Requisitos cobertos**: REQ-AUTH-001, REQ-AUTH-002, REQ-AUTH-003, REQ-DB-001, REQ-DB-003, REQ-INFRA-001

**Entregáveis**:
- Projeto Supabase configurado com tabelas: `patients`, `doctors`, `consultations`
- Autenticação via Supabase Auth (email/senha) com roles (patient/doctor)
- Middleware Next.js para proteção de rotas
- Layout base com navegação (sidebar para médico, header para paciente)
- Variáveis de ambiente configuradas (.env.local.example)
- Design system base (cores, tipografia, componentes Tailwind)

**Critérios de sucesso**:
- [ ] Paciente consegue criar conta e fazer login
- [ ] Médico consegue fazer login
- [ ] Rotas protegidas redirecionam corretamente
- [ ] Tabelas existem no Supabase com schemas corretos

**Plans:** 4 plans

Plans:
- [x] 01-01-PLAN.md — Supabase clients, DB schema, env validation, design system (Complete: 2026-02-07)
- [x] 01-02-PLAN.md — Auth pages (login/signup) and server actions (Complete: 2026-02-07)
- [x] 01-03-PLAN.md — Route protection (proxy.ts) and role-based layouts (Complete: 2026-02-07)
- [x] 01-04-PLAN.md — Human verification checkpoint

**Dependências**: Nenhuma

---

## Fase 2: Segurança e Compliance
**Objetivo**: Camada de segurança e conformidade com LGPD.

**Requisitos cobertos**: REQ-AUTH-004, REQ-DB-004

**Entregáveis**:
- Tela de consentimento LGPD antes da triagem
- Row Level Security (RLS) policies no Supabase
- Registro de consentimento no banco de dados

**Critérios de sucesso**:
- [ ] Paciente vê e aceita termo antes de iniciar triagem
- [ ] RLS impede acesso a dados de outros usuários
- [ ] Consentimento registrado com timestamp

**Dependências**: Fase 1

---

## Fase 3: Interface de Voz e Captura de Áudio
**Objetivo**: Paciente consegue falar com o sistema e ouvir respostas por voz em tempo real.

**Requisitos cobertos**: REQ-VOICE-001, REQ-VOICE-002, REQ-VOICE-003, REQ-VOICE-004, REQ-VOICE-005, REQ-UI-001

**Entregáveis**:
- Componente de captura de áudio via Web Audio API / WebRTC
- Integração com serviço STT (Deepgram ou Web Speech API)
- Integração com serviço TTS (ElevenLabs ou OpenAI)
- Detecção de silêncio / voice activity detection (VAD)
- UI da tela de triagem: avatar/animação do agente, indicadores de estado
- Transcrição em tempo real na tela

**Critérios de sucesso**:
- [ ] Microfone captura áudio sem PTT
- [ ] Fala do paciente é transcrita em tempo real
- [ ] Sistema reproduz áudio de resposta
- [ ] UI mostra estado: ouvindo / processando / falando
- [ ] Detecção de fim de fala funciona sem cortar paciente

**Dependências**: Fase 1

---

## Fase 4: Agente Conversacional LLM
**Objetivo**: Agente AI conduz anamnese médica completa com empatia e inteligência clínica.

**Requisitos cobertos**: REQ-LLM-001, REQ-LLM-002, REQ-LLM-003, REQ-LLM-004, REQ-LLM-005

**Entregáveis**:
- Abstração de provedor LLM (adapter pattern) — suportar OpenAI e Anthropic
- System prompt médico: instruções para anamnese completa, tom empático, guardrails
- Gerenciamento de contexto conversacional (histórico de mensagens)
- Lógica de condução da anamnese (QP → HDA → antecedentes → etc.)
- Guardrails: não diagnosticar, não prescrever, alertar emergência
- API route Next.js para streaming de respostas

**Critérios de sucesso**:
- [ ] Agente conduz conversa natural em pt-BR
- [ ] Cobre todos os itens da anamnese sem ser interrogativo
- [ ] Mantém contexto e não repete perguntas
- [ ] Não faz diagnóstico direto ao paciente
- [ ] Alerta sobre sinais de alarme
- [ ] Funciona com pelo menos 2 provedores LLM

**Dependências**: Fase 3 (para integração voz+LLM)

---

## Fase 5: Processamento e Resumo Clínico
**Objetivo**: Após conversa, AI gera resumo estruturado com hipóteses diagnósticas para o médico.

**Requisitos cobertos**: REQ-SUMMARY-001, REQ-SUMMARY-002, REQ-SUMMARY-003, REQ-SUMMARY-004, REQ-DB-002

**Entregáveis**:
- Prompt especializado para geração de resumo clínico estruturado
- Geração de hipóteses diagnósticas com justificativas
- Sugestão de conduta inicial
- Classificação de urgência (emergência / urgência / pouco urgente / não urgente)
- Persistência da consulta no Supabase (transcrição, resumo, hipóteses, urgência)
- Tela de confirmação para o paciente ("sua triagem foi enviada ao médico")

**Critérios de sucesso**:
- [ ] Resumo contém todos os campos estruturados
- [ ] Hipóteses são clinicamente coerentes
- [ ] Urgência é classificada corretamente
- [ ] Consulta é salva no banco com todos os dados
- [ ] Paciente vê confirmação ao final

**Dependências**: Fase 4

---

## Fase 6: Dashboard do Médico
**Objetivo**: Médico pode visualizar fila de pacientes, ler resumos e gerenciar atendimentos.

**Requisitos cobertos**: REQ-DASH-001, REQ-DASH-002, REQ-DASH-003, REQ-DASH-004, REQ-DASH-005

**Entregáveis**:
- Tela de fila de pacientes (lista ordenada por urgência + timestamp)
- Tela de detalhes: resumo clínico, hipóteses, sugestão de conduta
- Visualização da transcrição completa
- Ações: aceitar/rejeitar hipóteses, adicionar notas
- Gerenciamento de status (aguardando → em análise → contato → finalizado)
- Badges de urgência com cores (vermelho/laranja/amarelo/verde)

**Critérios de sucesso**:
- [ ] Fila mostra pacientes ordenados por urgência
- [ ] Médico lê resumo completo de cada paciente
- [ ] Status pode ser alterado
- [ ] Hipóteses podem ser aceitas/rejeitadas
- [ ] UI é funcional e clara

**Dependências**: Fase 5

---

## Fase 7: Contato Médico-Paciente
**Objetivo**: Médico pode iniciar contato com o paciente para finalizar consulta.

**Requisitos cobertos**: REQ-CONTACT-001, REQ-CONTACT-002

**Entregáveis**:
- Botão "Contatar Paciente" no dashboard
- Integração com método de contato (link para Google Meet / WhatsApp / videochamada)
- Notificação ao paciente (email ou in-app) de que o médico quer contato
- Registro do contato no banco de dados

**Critérios de sucesso**:
- [ ] Médico inicia contato com 1 clique
- [ ] Paciente recebe notificação
- [ ] Contato é registrado na consulta

**Dependências**: Fase 6

---

## Fase 8: Polish e Responsividade
**Objetivo**: Refinamento visual, responsividade mobile e experiência do usuário.

**Requisitos cobertos**: REQ-UI-002, REQ-UI-003

**Entregáveis**:
- Tela de histórico de consultas do paciente
- Responsividade em todas as telas (mobile-first adjustments)
- Animações e transições (loading states, feedback visual)
- Tratamento de erros amigável (falha de microfone, perda de conexão, etc.)

**Critérios de sucesso**:
- [ ] Todas as telas funcionam em mobile
- [ ] Paciente pode ver histórico
- [ ] Erros são tratados com mensagens claras

**Dependências**: Fase 7

---

## Fase 9: Deploy e Produção
**Objetivo**: Aplicação rodando em produção.

**Requisitos cobertos**: REQ-INFRA-002

**Entregáveis**:
- Deploy na Vercel
- Supabase em modo produção
- Domínio configurado
- Monitoramento básico (Vercel Analytics)
- README com instruções de setup

**Critérios de sucesso**:
- [ ] App acessível via URL pública
- [ ] Todas as funcionalidades funcionando em produção
- [ ] Performance aceitável (< 3s load time)

**Dependências**: Fase 8

---

## Cobertura de Requisitos

| Requisito | Fase | Status |
|---|---|---|
| REQ-AUTH-001 | 1 | Pendente |
| REQ-AUTH-002 | 1 | Pendente |
| REQ-AUTH-003 | 1 | Pendente |
| REQ-AUTH-004 | 2 | Pendente |
| REQ-VOICE-001 | 3 | Pendente |
| REQ-VOICE-002 | 3 | Pendente |
| REQ-VOICE-003 | 3 | Pendente |
| REQ-VOICE-004 | 3 | Pendente |
| REQ-VOICE-005 | 3 | Pendente |
| REQ-LLM-001 | 4 | Pendente |
| REQ-LLM-002 | 4 | Pendente |
| REQ-LLM-003 | 4 | Pendente |
| REQ-LLM-004 | 4 | Pendente |
| REQ-LLM-005 | 4 | Pendente |
| REQ-SUMMARY-001 | 5 | Pendente |
| REQ-SUMMARY-002 | 5 | Pendente |
| REQ-SUMMARY-003 | 5 | Pendente |
| REQ-SUMMARY-004 | 5 | Pendente |
| REQ-DASH-001 | 6 | Pendente |
| REQ-DASH-002 | 6 | Pendente |
| REQ-DASH-003 | 6 | Pendente |
| REQ-DASH-004 | 6 | Pendente |
| REQ-DASH-005 | 6 | Pendente |
| REQ-CONTACT-001 | 7 | Pendente |
| REQ-CONTACT-002 | 7 | Pendente |
| REQ-DB-001 | 1 | Pendente |
| REQ-DB-002 | 5 | Pendente |
| REQ-DB-003 | 1 | Pendente |
| REQ-DB-004 | 2 | Pendente |
| REQ-UI-001 | 3 | Pendente |
| REQ-UI-002 | 8 | Pendente |
| REQ-UI-003 | 8 | Pendente |
| REQ-INFRA-001 | 1 | Pendente |
| REQ-INFRA-002 | 9 | Pendente |

**Cobertura: 34/34 requisitos mapeados (100%)**
