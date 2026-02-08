# Phase 03: Interface de Voz e Captura de Audio — Control Document

**Phase Start:** 2026-02-08
**Current Stage:** 1 COMPLETE — awaiting decisions before Stage 2
**Status:** Research Complete — Pending Decision Review

---

## Stage Overview

| # | Stage | Status | Start | End |
|---|-------|--------|-------|-----|
| 1 | Research (Pesquisa) | COMPLETE | 2026-02-08 | 2026-02-08 |
| 2 | Planning (Planejamento) | PENDING (blocked by decisions) | — | — |
| 3 | Execution (Execucao) | PENDING | — | — |

---

## Stage 1: Research (Pesquisa)

**Objective:** Gather comprehensive knowledge about all technologies, services, and patterns needed for voice interface implementation.

### Agent Team

| Role | Agent | Status | Output |
|------|-------|--------|--------|
| Orchestrator | Main Claude | COMPLETE | This document + coordination |
| Researcher A | Audio & Streaming | COMPLETE | 03-RESEARCH-A-audio.md |
| Researcher B | STT & TTS Services | COMPLETE | 03-RESEARCH-B-stt-tts.md |
| Researcher C | VAD & UI Patterns | COMPLETE | 03-RESEARCH-C-vad-ui.md |
| Devil's Advocate | Reviewer | COMPLETE | 03-RESEARCH-REVIEW.md |

### Research Domains

**Researcher A — Audio Capture & Real-time Streaming:**
- Web Audio API vs WebRTC vs MediaRecorder API
- Audio formats and encoding (PCM, Opus, WebM)
- Browser compatibility (Chrome, Firefox, Safari, Edge)
- Real-time streaming patterns in Next.js (WebSocket, Server-Sent Events)
- Audio buffer management and latency optimization
- Microphone permissions and error handling

**Researcher B — STT & TTS Services:**
- STT comparison: Deepgram, OpenAI Whisper, Web Speech API, AssemblyAI, OpenAI Realtime API
- TTS comparison: ElevenLabs, OpenAI TTS, Web Speech Synthesis API, Azure TTS
- Pricing, latency, pt-BR quality for each
- Streaming vs batch processing
- API integration patterns (REST, WebSocket, SDK)
- OpenAI Realtime API as unified STT+TTS+LLM solution

**Researcher C — VAD & Voice UI:**
- VAD libraries: @ricky0123/vad-web, Silero VAD, custom energy-based
- Turn detection strategies (silence threshold, energy-based, model-based)
- Voice UI patterns: states (listening/processing/speaking), visual feedback
- Avatar/animation for AI agent (Lottie, CSS, canvas)
- Accessibility considerations for voice interfaces
- Mobile browser microphone behavior (iOS Safari, Android Chrome)

### Research Questions to Answer

1. What is the best STT service for real-time pt-BR transcription considering quality, latency, and cost?
2. What is the best TTS service for natural pt-BR speech?
3. Should we use OpenAI Realtime API as an all-in-one solution or compose individual services?
4. What VAD approach gives the best turn detection without cutting off the patient?
5. What is the recommended audio pipeline architecture for our Next.js stack?
6. What are the browser compatibility constraints we need to handle?
7. What WebSocket/streaming library works best with Next.js 16?

---

## Stage 2: Planning (Planejamento)

**Status:** PENDING — awaits Stage 1 completion

### Agent Team (planned)

| Role | Agent | Status | Output |
|------|-------|--------|--------|
| Orchestrator | Main Claude | PENDING | Coordination |
| Planner | Implementation Planner | PENDING | 03-XX-PLAN.md files |
| Devil's Advocate | Plan Reviewer | PENDING | 03-PLAN-REVIEW.md |

---

## Stage 3: Execution (Execucao)

**Status:** PENDING — awaits Stage 2 completion

### Agent Team (planned)

| Role | Agent | Status | Output |
|------|-------|--------|--------|
| Orchestrator | Main Claude | PENDING | Coordination |
| Implementer | Code Writer | PENDING | Source code |
| Devil's Advocate | Code Reviewer | PENDING | Review notes |

---

## Decision Log

| # | Date | Decision | Rationale |
|---|------|----------|-----------|
| — | — | Decisions pending — see "Blocker Decisions" below | — |

## Blocker Decisions (must resolve before Stage 2)

From Devil's Advocate review (03-RESEARCH-REVIEW.md), 12 action items identified.
The TOP 5 decisions needed from the project owner:

1. **Pipeline architecture:** Composed (Deepgram + GPT-4o-mini + OpenAI TTS) vs OpenAI Realtime API? DA recommends composed pipeline only.
2. **Deployment strategy:** Vercel + separate WS server? Or evaluate LiveKit/managed service? Roadmap says "Vercel" but WS server cant run there.
3. **LGPD for audio data:** Must verify DPAs with Deepgram/OpenAI BEFORE coding. Audio = sensitive health data under LGPD.
4. **Barge-in behavior:** Allow patient to interrupt AI speaking? Or mute mic during TTS? Impacts echo cancellation strategy.
5. **Evaluate LiveKit?** Could replace custom WebSocket server entirely and solve transport + deployment + visualization.

## Notes

- Phase 3 depends on Phase 1 (complete) — no dependency on Phase 2
- All UI text in Portuguese (Brazil), all code/docs in English
- Must consider LGPD compliance from Phase 2 (consent gating before triage)
- DA review rated research: 7/10 individual quality, 5/10 cross-document coherence, 3/10 production readiness
- 6 contradictions found between researchers — must reconcile before planning
- LGPD compliance for audio data is the #1 project risk identified
