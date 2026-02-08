# STATE — Triagem Virtual

## Status Atual

| Campo | Valor |
|---|---|
| Milestone | v1 |
| Fase Atual | 01 de 9 (Fundação — DB, Auth e Layout) |
| Próxima Ação | Execute Phase 01 Plan 04 (Design System) |
| Última Atualização | 2026-02-07 |

## Progresso por Fase

| Fase | Nome | Status |
|---|---|---|
| 1 | Fundação — DB, Auth e Layout | ███░ Em progresso (3/4 planos completos) |
| 2 | Segurança e Compliance | Pendente |
| 3 | Interface de Voz e Captura de Áudio | Pendente |
| 4 | Agente Conversacional LLM | Pendente |
| 5 | Processamento e Resumo Clínico | Pendente |
| 6 | Dashboard do Médico | Pendente |
| 7 | Contato Médico-Paciente | Pendente |
| 8 | Polish e Responsividade | Pendente |
| 9 | Deploy e Produção | Pendente |

## Decisões Tomadas

1. **Voz**: WebRTC + Web Audio API no browser (não telefonia)
2. **LLM**: Arquitetura flexível com adapter pattern (OpenAI + Anthropic)
3. **Banco**: Supabase (PostgreSQL + Auth + Storage)
4. **Protocolo**: Sem protocolo rígido (Manchester/ESI) — agente treinado em boa anamnese
5. **Idioma**: pt-BR para UI, inglês para código
6. **MVP**: Fluxo completo end-to-end
7. **Persistência**: Full — dados médicos retidos conforme regulamentação

## Planos Completados

| Fase | Plano | Nome | Data Completo | SUMMARY |
|------|-------|------|---------------|---------|
| 01 | 01 | Foundation Setup | 2026-02-07 | .planning/phases/01-fundacao/01-01-SUMMARY.md |
| 01 | 02 | Authentication Pages | 2026-02-07 | .planning/phases/01-funda-o-banco-de-dados-auth-e-layout-base/01-02-SUMMARY.md |
| 01 | 03 | Auth Middleware & Layouts | 2026-02-07 | .planning/phases/01-funda-o-banco-de-dados-auth-e-layout-base/01-03-SUMMARY.md |

## Session Continuity

| Campo | Valor |
|---|---|
| Última Sessão | 2026-02-07 |
| Parado em | Phase 01 Plan 03 — Complete |
| Próximo Arquivo | Phase 01 Plan 04 (Design System) |

## Notas

- Desenvolvimento em Windows
- Next.js 16.1.6 com App Router
- React 19 + Tailwind CSS 4
- USER SETUP REQUIRED: Complete .planning/phases/01-fundacao/01-USER-SETUP.md before Phase 01 Plan 02
