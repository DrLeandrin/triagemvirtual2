# REQUIREMENTS — Triagem Virtual v1

## Legenda de Prioridade
- **P0**: Essencial para MVP — sem isso não funciona
- **P1**: Importante para MVP — experiência degradada sem isso
- **P2**: Desejável — pode ser adicionado após MVP funcional

---

## 1. Autenticação e Gestão de Usuários

### REQ-AUTH-001: Autenticação de Pacientes (P0)
Pacientes devem poder criar conta e fazer login via email/senha usando Supabase Auth.

### REQ-AUTH-002: Autenticação de Médicos (P0)
Médicos devem poder fazer login com credenciais próprias. Papel (role) de médico atribuído no banco.

### REQ-AUTH-003: Proteção de Rotas (P0)
Rotas do dashboard médico devem ser protegidas. Pacientes não podem acessar área do médico e vice-versa.

### REQ-AUTH-004: Consentimento LGPD (P1)
Antes de iniciar a triagem, paciente deve aceitar termo de consentimento para coleta e processamento de dados de saúde.

---

## 2. Agente de Voz AI

### REQ-VOICE-001: Captura de Áudio em Tempo Real (P0)
Sistema deve capturar áudio do microfone do paciente em tempo real via WebRTC/Web Audio API, sem necessidade de PTT (push-to-talk).

### REQ-VOICE-002: Speech-to-Text (STT) (P0)
Áudio capturado deve ser transcrito em tempo real para texto usando serviço de STT (Deepgram, Whisper, ou Web Speech API).

### REQ-VOICE-003: Text-to-Speech (TTS) (P0)
Respostas do agente AI devem ser convertidas em fala natural em português brasileiro usando serviço de TTS (ElevenLabs, OpenAI TTS).

### REQ-VOICE-004: Detecção de Silêncio/Turno (P1)
Sistema deve detectar quando o paciente parou de falar para enviar a transcrição ao LLM, evitando interrupções.

### REQ-VOICE-005: Indicador Visual de Estado (P1)
UI deve mostrar estado atual da conversa: "ouvindo", "processando", "falando".

---

## 3. Agente Conversacional (LLM)

### REQ-LLM-001: Condução de Anamnese (P0)
O agente deve conduzir uma anamnese médica completa seguindo boa prática clínica:
- Identificação do paciente
- Queixa principal (QP)
- História da doença atual (HDA)
- Antecedentes pessoais patológicos
- Medicações em uso
- Alergias
- Antecedentes familiares
- Hábitos de vida
- Revisão de sistemas (quando relevante)

### REQ-LLM-002: Tom Empático e Acolhedor (P0)
O agente deve manter tom empático, usar linguagem acessível, demonstrar conexão com o paciente. Não deve soar robótico ou interrogativo.

### REQ-LLM-003: Flexibilidade de Provedor LLM (P1)
Sistema deve suportar múltiplos provedores de LLM (OpenAI, Anthropic, etc.) via abstração/adapter pattern. Configurável via variáveis de ambiente.

### REQ-LLM-004: Contexto Conversacional (P0)
O agente deve manter contexto da conversa inteira, referenciando informações já coletadas e evitando perguntas redundantes.

### REQ-LLM-005: Guardrails de Segurança (P1)
O agente NÃO deve:
- Fazer diagnósticos definitivos ao paciente
- Prescrever medicações
- Dar orientações de tratamento diretamente ao paciente
- Deve orientar busca de emergência em casos de sinais de alarme

---

## 4. Processamento e Resumo Clínico

### REQ-SUMMARY-001: Geração de Resumo Estruturado (P0)
Após a conversa, o sistema deve gerar um resumo clínico estruturado contendo:
- Dados do paciente
- Queixa principal
- HDA resumida
- Antecedentes relevantes
- Medicações e alergias
- Hipóteses diagnósticas (ordenadas por probabilidade)
- Sugestão de conduta

### REQ-SUMMARY-002: Hipóteses Diagnósticas (P0)
O sistema deve gerar lista de hipóteses diagnósticas baseadas nos dados coletados, ordenadas por probabilidade, com justificativa clínica breve.

### REQ-SUMMARY-003: Sugestão de Conduta (P1)
O sistema deve sugerir conduta inicial (exames, encaminhamentos, orientações) como apoio à decisão do médico. Sempre como sugestão, nunca como prescrição.

### REQ-SUMMARY-004: Classificação de Urgência (P1)
O resumo deve incluir classificação de urgência (emergência, urgência, pouco urgente, não urgente) para priorização da fila médica.

---

## 5. Dashboard do Médico

### REQ-DASH-001: Fila de Pacientes (P0)
Dashboard deve exibir lista de pacientes triados aguardando revisão, ordenada por urgência e ordem de chegada.

### REQ-DASH-002: Visualização de Resumo (P0)
Médico deve poder clicar em um paciente e ver o resumo clínico completo gerado pela AI.

### REQ-DASH-003: Reprodução da Conversa (P2)
Médico deve poder ler a transcrição completa da conversa entre AI e paciente.

### REQ-DASH-004: Aceitar/Rejeitar Hipóteses (P1)
Médico deve poder marcar hipóteses como aceitas, rejeitadas, ou adicionar novas. Isso alimenta aprendizado futuro.

### REQ-DASH-005: Status do Atendimento (P0)
Médico deve poder alterar status do atendimento: "aguardando revisão", "em análise", "contato agendado", "finalizado".

---

## 6. Contato Médico-Paciente

### REQ-CONTACT-001: Iniciar Contato (P0)
Médico deve poder iniciar contato com o paciente a partir do dashboard para finalizar a consulta.

### REQ-CONTACT-002: Método de Contato (P1)
v1: botão que abre videochamada ou link para contato. Pode ser integração com ferramenta externa (Google Meet, WhatsApp, etc.).

---

## 7. Banco de Dados e Persistência

### REQ-DB-001: Armazenamento de Pacientes (P0)
Dados cadastrais dos pacientes devem ser persistidos no Supabase (PostgreSQL).

### REQ-DB-002: Armazenamento de Consultas (P0)
Cada sessão de triagem deve ser salva: transcrição, resumo, hipóteses, status, timestamps.

### REQ-DB-003: Armazenamento de Médicos (P0)
Cadastro de médicos com dados profissionais (CRM, especialidade).

### REQ-DB-004: Row Level Security (P1)
Implementar RLS no Supabase para garantir que cada usuário acessa apenas seus próprios dados.

---

## 8. Interface do Paciente

### REQ-UI-001: Tela de Triagem (P0)
Interface onde o paciente conversa com o agente AI. Deve mostrar:
- Indicador visual do agente (avatar ou animação)
- Status da conversa (ouvindo/processando/falando)
- Botão para encerrar conversa
- Transcrição em tempo real (opcional, mas recomendado)

### REQ-UI-002: Tela de Histórico (P2)
Paciente pode ver histórico de suas consultas anteriores.

### REQ-UI-003: Interface Responsiva (P1)
UI deve funcionar bem em desktop e mobile (responsive design).

---

## 9. Infraestrutura e DevOps

### REQ-INFRA-001: Variáveis de Ambiente (P0)
Todas as chaves de API e configurações sensíveis via variáveis de ambiente (.env.local).

### REQ-INFRA-002: Deploy (P2)
Preparar para deploy na Vercel com Supabase como backend.

---

## Matriz de Rastreabilidade

| REQ-ID | Prioridade | Fase |
|---|---|---|
| REQ-AUTH-001 | P0 | Fase 1 |
| REQ-AUTH-002 | P0 | Fase 1 |
| REQ-AUTH-003 | P0 | Fase 1 |
| REQ-AUTH-004 | P1 | Fase 2 |
| REQ-VOICE-001 | P0 | Fase 3 |
| REQ-VOICE-002 | P0 | Fase 3 |
| REQ-VOICE-003 | P0 | Fase 3 |
| REQ-VOICE-004 | P1 | Fase 3 |
| REQ-VOICE-005 | P1 | Fase 3 |
| REQ-LLM-001 | P0 | Fase 4 |
| REQ-LLM-002 | P0 | Fase 4 |
| REQ-LLM-003 | P1 | Fase 4 |
| REQ-LLM-004 | P0 | Fase 4 |
| REQ-LLM-005 | P1 | Fase 4 |
| REQ-SUMMARY-001 | P0 | Fase 5 |
| REQ-SUMMARY-002 | P0 | Fase 5 |
| REQ-SUMMARY-003 | P1 | Fase 5 |
| REQ-SUMMARY-004 | P1 | Fase 5 |
| REQ-DASH-001 | P0 | Fase 6 |
| REQ-DASH-002 | P0 | Fase 6 |
| REQ-DASH-003 | P2 | Fase 6 |
| REQ-DASH-004 | P1 | Fase 6 |
| REQ-DASH-005 | P0 | Fase 6 |
| REQ-CONTACT-001 | P0 | Fase 7 |
| REQ-CONTACT-002 | P1 | Fase 7 |
| REQ-DB-001 | P0 | Fase 1 |
| REQ-DB-002 | P0 | Fase 5 |
| REQ-DB-003 | P0 | Fase 1 |
| REQ-DB-004 | P1 | Fase 2 |
| REQ-UI-001 | P0 | Fase 3 |
| REQ-UI-002 | P2 | Fase 8 |
| REQ-UI-003 | P1 | Fase 8 |
| REQ-INFRA-001 | P0 | Fase 1 |
| REQ-INFRA-002 | P2 | Fase 9 |
