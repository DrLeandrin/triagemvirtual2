# PROJECT: Triagem Virtual

## Visão Geral

Sistema de triagem médica virtual mediado por um agente de inteligência artificial com capacidade de voz em tempo real (sem PTT). O agente conduz uma conversa empática e completa com o paciente para coletar a história clínica, processa as informações e apresenta ao médico um resumo estruturado com hipóteses diagnósticas e sugestões de conduta.

## Fluxo Principal

1. **Paciente inicia consulta** → Acessa a plataforma web
2. **Agente AI coleta dados** → Conversa por voz em tempo real (WebRTC), coleta história clínica completa (queixa principal, HDA, antecedentes, medicações, alergias, revisão de sistemas)
3. **AI processa e resume** → Gera resumo estruturado com hipóteses diagnósticas e sugestão de conduta
4. **Médico revisa** → Dashboard do médico exibe fila de pacientes triados, resumos e sugestões
5. **Médico contata paciente** → Médico finaliza a consulta com o paciente

## Princípios do Agente AI

- **Conexão**: Estabelecer rapport com o paciente
- **Empatia**: Comunicação humanizada e acolhedora
- **Completude**: Coleta de história clínica abrangente e organizada
- **Sem protocolo rígido**: Não segue Manchester/ESI — o agente é treinado em boa prática de anamnese médica

## Stack Técnica

| Componente | Tecnologia |
|---|---|
| Framework | Next.js 16.1.6 (App Router) |
| Linguagem | TypeScript 5 |
| UI | React 19 + Tailwind CSS 4 |
| Voz (STT) | Web Speech API / Deepgram / Whisper / ElevenLabs |
| Voz (TTS) | ElevenLabs / OpenAI TTS |
| Comunicação tempo real | WebRTC |
| LLM | Flexível/configurável (OpenAI, Claude, etc.) |
| Banco de dados | PostgreSQL via Supabase |
| Autenticação | Supabase Auth |
| Storage | Supabase Storage |
| Idioma da UI | Português (Brasil) |

## Usuários

| Papel | Descrição |
|---|---|
| Paciente | Interage com o agente AI por voz para relatar sintomas e história clínica |
| Médico | Revisa resumos gerados pela AI, valida hipóteses, contata o paciente |
| Admin | (futuro) Gerencia configurações, protocolos, usuários |

## Requisitos de Compliance

- **LGPD**: Dados de saúde são dados sensíveis — requerem consentimento explícito, criptografia, e direito de exclusão
- **CFM**: Telemedicina no Brasil regulamentada pela Resolução CFM 2.314/2022
- **Retenção de dados**: Prontuários médicos devem ser retidos por 20 anos (CFM)

## Escopo v1 (MVP)

Fluxo completo end-to-end:
1. Paciente faz login e inicia sessão de triagem
2. Agente AI conduz conversa por voz em tempo real
3. AI gera resumo com hipóteses diagnósticas
4. Médico visualiza dashboard com fila e resumos
5. Médico pode contatar paciente para finalizar

## Fora do Escopo v1

- App mobile nativo
- Integração com sistemas hospitalares (HL7/FHIR)
- Prescrição eletrônica
- Agendamento de exames
- Múltiplos idiomas (apenas pt-BR no v1)
- Painel administrativo completo
- Integração com planos de saúde

## Repositório

- **URL**: https://github.com/DrLeandrin/triagemvirtual2.git
- **Branch principal**: main
- **Plataforma**: Windows (desenvolvimento)
