# Research 1B-C: Gap Analysis & Compliance
**Researcher:** Agent C (Gaps & Compliance Focus)
**Date:** 2026-02-08
**Confidence:** HIGH (LGPD legal analysis, ElevenLabs capabilities), MEDIUM (CFM AI regulation -- still in draft), LOW (long-term vendor stability predictions)

---

## Executive Summary

Centralizing on ElevenLabs Conversational AI resolves the majority of the architectural and deployment problems identified by the Devil's Advocate review. The platform eliminates the need for a custom WebSocket server, handles sample rate conversion internally, provides WebRTC-grade echo cancellation and barge-in, includes built-in VAD/turn detection, and deploys as a client-side SDK with no persistent server infrastructure -- directly compatible with Vercel. Of the 12 action items from the DA review, ElevenLabs fully resolves 7, partially resolves 3, and leaves 2 unchanged.

However, **LGPD compliance remains the critical risk**. ElevenLabs is headquartered in New York with primary processing in the US and Netherlands. While they offer a DPA referencing Brazil SCCs, HIPAA BAA support, SOC 2 Type II / ISO 27001 certifications, and configurable retention/zero-retention modes, several gaps remain: (1) no Brazil-based data residency option exists today, (2) the Enterprise tier is required for HIPAA/zero-retention features which is the only tier appropriate for health data, (3) audio data is used for model training by default on non-Enterprise plans, and (4) our 20-year CFM medical record retention obligation cannot be satisfied by ElevenLabs alone -- we must independently store transcripts and potentially audio.

The CFM is actively drafting Resolution 2431/2025 on AI in medicine, which will classify AI triage systems by risk level. Our system (AI-mediated preliminary triage with mandatory physician review) will likely be classified as medium risk, requiring human supervision, data protection, explainability, and clinical validation. The existing architecture (AI collects data, physician makes decisions) aligns well with these forthcoming requirements.

**Recommendation:** Proceed with ElevenLabs Conversational AI on an Enterprise plan with HIPAA BAA, zero retention mode enabled for audio, and a parallel data pipeline that exports transcripts and structured data via post-call webhooks to Supabase for our own 20-year retention. This approach resolves the majority of architectural issues while creating a manageable LGPD compliance posture -- provided we execute a proper RIPD (Data Protection Impact Assessment), obtain explicit patient consent for international data transfer, and maintain our own complete medical records independent of ElevenLabs.

---

## 1. LGPD Compliance Analysis -- CRITICAL

**Section Confidence: HIGH**

### 1.1 ElevenLabs Corporate and Infrastructure Profile

| Attribute | Detail |
|-----------|--------|
| **Headquarters** | New York, NY, USA |
| **Legal entities** | ElevenLabs Inc. (US), EU presence (London/Poland office) |
| **Hosting locations** | United States, Netherlands, Singapore |
| **Data residency options** | EU (Enterprise only), India (Enterprise only), **No Brazil option** |
| **Valuation** | $11 billion (Feb 2026, Series D) |
| **ARR** | ~$330M (end of 2025) |
| **Total funding** | $850M across multiple rounds |
| **Key investors** | Nvidia, Lightspeed, BOND Capital, AMP Coalition |

### 1.2 Data Processing Agreement (DPA)

ElevenLabs maintains a publicly available [DPA](https://elevenlabs.io/dpa) with the following LGPD-relevant provisions:

- **Recognizes LGPD** as applicable data protection legislation alongside GDPR and CCPA.
- **Brazil Standard Contractual Clauses (Brazil SCCs)** are referenced as a contractual protection mechanism for international data transfers, approved by ANPD.
- **Subprocessor management:** Written agreements with subprocessors imposing privacy obligations substantially as protective as the DPA. 30-day advance notice for new subprocessors.
- **Data Protection Impact Assessment (DPIA/RIPD) assistance:** ElevenLabs provides commercially reasonable assistance for DPIAs.
- **Data subject rights:** ElevenLabs assists the controller (us) in responding to data subject requests.
- **Data breach notification:** Commits to notification without undue delay.
- **Audit rights:** Customer may audit ElevenLabs compliance (details in DPA).

**Assessment:** The DPA is well-structured for LGPD compliance. The inclusion of Brazil SCCs is notable and indicates awareness of LGPD requirements. However, **we must sign the DPA as an Enterprise customer** -- the default consumer/business privacy policy is insufficient for health data processing.

### 1.3 Audio Data Storage and Retention

| Configuration | Behavior |
|---------------|----------|
| **Default retention** | Conversation transcripts and audio stored for **2 years** |
| **Configurable retention** | Per-agent settings: reduce retention period, apply retroactively |
| **Audio saving** | Can be disabled per agent (prevents new recordings from being stored) |
| **Zero Retention Mode** (Enterprise) | Audio inputs/outputs not stored after processing; data deleted immediately after request completion; backup retention up to 30 days then purged |
| **Conversation deletion API** | `DELETE /v1/convai/conversations/{conversation_id}` available |

**Critical finding for our 20-year obligation:** ElevenLabs maximum retention is 2 years (default). Even if we do not use Zero Retention Mode, we cannot rely on ElevenLabs for our 20-year CFM record retention. **We must independently capture and store all conversation data (transcripts, structured medical data, and optionally audio) in our own Supabase database via post-call webhooks.**

### 1.4 Data Training and Opt-Out

| Plan | Training behavior |
|------|-------------------|
| **Free/Starter/Creator/Pro** | ElevenLabs uses Voice Data to improve models. Opt-out available in account settings, but only applies to data submitted AFTER opt-out. |
| **Enterprise** | **ElevenLabs does not train on Enterprise customer data** by default. |

**Assessment:** For health data, the Enterprise tier is the only acceptable option. Non-Enterprise plans present an unacceptable risk of patient audio being used for model training.

### 1.5 International Data Transfer Under LGPD Art. 33

LGPD Article 33 permits international data transfer under the following conditions (relevant to our case):

1. **Adequate protection level** -- US is not on any ANPD adequacy list. Not applicable.
2. **Contractual clauses (Brazil SCCs)** -- ElevenLabs references Brazil SCCs in their DPA. **This is our primary legal basis.**
3. **Specific and prominent consent** -- Patient must explicitly consent to international data transfer with prior information about the international nature. **Our Phase 2 consent flow must be updated to include this.**
4. **Necessary for contract execution** -- Arguable but weak for health data.

**Required actions for compliance:**

| Action | Priority | Status |
|--------|----------|--------|
| Sign Enterprise DPA with Brazil SCCs | P0 | Not done |
| Update patient consent form to explicitly mention international transfer (US/EU) | P0 | Not done -- Phase 2 consent exists but does not mention international transfer |
| Conduct RIPD (Relatorio de Impacto a Protecao de Dados Pessoais) | P0 | Not done |
| Map complete data flow: patient browser -> ElevenLabs (US/NL) -> our Supabase -> retention | P0 | Not done |
| Engage Brazilian data protection counsel for legal review | P1 | Not done |
| Implement data subject rights workflow (access, deletion, portability) | P1 | Not done |

### 1.6 HIPAA and Healthcare Compliance

ElevenLabs offers healthcare compliance through their Enterprise tier:

- **Business Associate Agreement (BAA):** Available for Enterprise customers. Required for PHI processing.
- **HIPAA-eligible configuration requires:**
  - Zero Retention Mode enabled
  - BAA executed
  - LLM Allowlist (prevents use of non-compliant LLMs)
  - PII Redaction (auto-redacts sensitive fields before storage)
  - Audio files not stored
- **Certifications:** SOC 2 Type II (zero exceptions), ISO 27001, PCI DSS Level 1
- **Encryption:** In transit (TLS) and at rest

**Assessment:** While Brazil does not follow HIPAA, the HIPAA-compliant configuration represents the best-practice baseline for health data. LGPD's requirements for sensitive data (Art. 11) and security measures (Art. 46) align closely with HIPAA's technical safeguards. **We should treat HIPAA BAA configuration as our floor, not our ceiling.**

### 1.7 Right of Deletion vs 20-Year Retention Reconciliation

This is the most complex LGPD challenge:

- **LGPD Art. 18, VI** guarantees the right to deletion of personal data.
- **CFM Resolution 2.314/2022 and medical records law** require 20-year retention.
- **LGPD Art. 16** provides exceptions to deletion when retention is required for legal or regulatory compliance.

**Resolution strategy:**
1. Audio on ElevenLabs: Use Zero Retention Mode. Audio is never stored by ElevenLabs. No deletion request needed to them for audio.
2. Transcripts and medical summaries in Supabase: Retained for 20 years per CFM. When patient requests deletion under LGPD, inform them that medical records are retained per Art. 16 (legal obligation) but non-medical personal data can be deleted.
3. Document this in our privacy policy and consent form.
4. If patient insists on audio deletion, we have no audio to delete (Zero Retention Mode). The transcript is a medical record subject to 20-year retention.

### 1.8 Data Residency Gap

**No Brazil data residency is available.** ElevenLabs offers EU and India residency (Enterprise only). Patient audio will be processed in the US or Netherlands.

This is not a blocker if:
- We use Brazil SCCs (contractual basis under Art. 33)
- We obtain specific consent for international transfer
- We conduct and document a RIPD
- We implement technical safeguards (encryption, access controls, zero retention)

However, it is a **risk factor** that increases audit scrutiny and patient concerns. If ElevenLabs adds LATAM or Brazil residency in the future, we should migrate immediately.

---

## 2. CFM Telemedicine Compliance

**Section Confidence: MEDIUM (regulation still evolving for AI)**

### 2.1 Resolution CFM 2.314/2022 -- Telemedicine Requirements

Key requirements from the resolution:

| Requirement | Detail | Our Approach |
|-------------|--------|-------------|
| **Electronic Health Record (SRES)** | Must use a certified electronic health record system meeting NGS2 (ICP-Brasil security level) | Our Supabase database with RLS is the data store; full SRES certification may require additional work |
| **Data preservation** | Anamnesis data, exam results, and medical conduct must be preserved per legislation | Transcripts, structured summaries, and medical notes stored in Supabase for 20 years |
| **Security and confidentiality** | Patient data must be preserved with integrity, veracity, confidentiality, privacy, and irrefutability | Encryption at rest (Supabase), TLS in transit, RLS policies, audit logging |
| **Patient consent** | Patient must authorize telemedicine attendance and data transmission via informed consent | Phase 2 consent flow exists; must be expanded for voice data specifics |
| **Physician responsibility** | Physician is responsible for the attendance | Doctor reviews and signs off on AI triage -- never autonomous |

### 2.2 Does AI-Mediated Triage Qualify as Telemedicine?

**Analysis:** The CFM is actively preparing Resolution 2431/2025 to regulate AI in medicine. Key insights:

- **AI triage classification:** Likely **medium risk** under the forthcoming resolution, as it influences clinical decisions but does not make them autonomously.
- **Prohibited uses:** Autonomous AI systems making critical decisions without human supervision will be prohibited. Our architecture (AI collects -> physician reviews) avoids this.
- **Required features:** Human supervision, data protection, explainability of AI tools, clinical validation before deployment.
- **Our triage system is NOT practicing telemedicine directly** -- it is collecting patient history data (anamnesis) that is then reviewed by a licensed physician. The physician-patient encounter (via dashboard review + contact) is the telemedicine act.

**However:** The AI-mediated anamnese collection still produces medical documentation that must meet SRES standards. The conversation transcript and structured summary are part of the patient's medical record.

### 2.3 Documentation Requirements

| Document Type | Required? | Source | Our Implementation |
|---------------|-----------|--------|-------------------|
| Conversation transcript | YES | CFM 2.314/2022 (data preservation) | Post-call webhook -> Supabase `consultations.transcript` |
| Structured clinical summary | YES | CFM 2.314/2022 (anamnesis record) | ElevenLabs Data Collection -> webhook -> `consultations.summary` |
| Audio recording | UNCLEAR | CFM 2.314/2022 mentions "images and data"; audio is not explicitly required but could be argued as evidence | RECOMMENDED: Store audio optionally; use ElevenLabs audio webhook (base64) and save to Supabase Storage |
| Patient consent record | YES | CFM 2.314/2022 + LGPD | Phase 2 `consent_records` table with signed consent |
| Physician review record | YES | CFM 2.314/2022 (medical conduct) | Phase 6 doctor dashboard actions stored in `consultations` |

### 2.4 Audio Recording: Must We Store It?

**Assessment:** CFM 2.314/2022 does not explicitly mandate audio recording for telemedicine. It requires preservation of "data and images." However:

1. The AI transcript IS the medical record of the interaction. It satisfies documentation requirements.
2. Audio recording would serve as **evidence** in case of disputes or audits.
3. The CFM AI resolution (in draft) emphasizes **transparency and explainability** -- having the raw audio provides maximum explainability.

**Recommendation:** Implement audio storage as a configurable option:
- Default: Store transcript only (Zero Retention on ElevenLabs, transcript via webhook to Supabase)
- Optional: Store audio via ElevenLabs post-call audio webhook (base64 encoded) to Supabase Storage or S3-compatible storage
- Let the deploying healthcare organization decide based on their risk tolerance

---

## 3. Gap Analysis: ElevenLabs vs Full Requirements

**Section Confidence: HIGH**

### 3.1 Phase 3 Requirements Coverage

| Requirement | Description | ElevenLabs Covers? | Gap / What We Build |
|---|---|---|---|
| **REQ-VOICE-001** | Real-time audio capture, no PTT | YES -- React SDK handles getUserMedia, WebRTC/WebSocket transport, and streaming | Minimal: just render the `<Conversation>` component or call `useConversation()` hook |
| **REQ-VOICE-002** | Speech-to-Text in real-time | YES -- Uses internal STT engine (Scribe v2 Realtime, 150ms latency, 99 languages, 3.1% WER on Portuguese FLEURS) | No gap. Scribe v2 is competitive with or better than Deepgram Nova-3 for pt-BR |
| **REQ-VOICE-003** | Text-to-Speech in pt-BR | YES -- ElevenLabs is the industry leader in TTS quality; 13+ pt-BR voices; Eleven v3 model available | No gap. This is ElevenLabs' core strength |
| **REQ-VOICE-004** | Silence/turn detection | YES -- Built-in VAD with configurable turn detection; supports barge-in | No gap. Eliminates need for @ricky0123/vad-web and its 7-10MB download |
| **REQ-VOICE-005** | Visual state indicator | PARTIAL -- SDK provides conversation state callbacks (listening/thinking/speaking) but NO visual component | We build: voice orb animation, state indicator UI in React |
| **REQ-UI-001** | Triage screen UI | NO -- ElevenLabs provides no UI components for triage | We build: full triage screen layout, transcript display, emergency button, end conversation button |

### 3.2 What ElevenLabs Does NOT Cover

| System Component | Phase | Description | Who Builds |
|---|---|---|---|
| Patient authentication | Phase 1 (done) | Supabase Auth, role-based access | Already built |
| LGPD consent flow | Phase 2 (done) | Consent screen, consent_records table | Already built; needs update for voice-specific consent |
| Agent system prompt / medical anamnesis logic | Phase 4 | The LLM instructions for conducting clinical interview | We configure in ElevenLabs Agent dashboard OR custom LLM |
| Consultation data persistence | Phase 5 | Save transcript, summary, diagnosis to Supabase | We build: post-call webhook handler -> Supabase insert |
| Post-conversation summary generation | Phase 5 | Structured clinical summary with diagnosis hypotheses | ElevenLabs Data Collection + our server-side processing |
| Doctor dashboard | Phase 6 | Queue, review, accept/reject diagnoses | We build entirely |
| Doctor-patient contact | Phase 7 | Video call or messaging | We build / integrate |
| Triage screen UI components | Phase 3 | Orb, transcript, controls, emergency button | We build with React + Tailwind |
| Emergency handling | Phase 3 | Emergency button behavior, SAMU (192) integration | We design and build |
| Error recovery / conversation resumption | Phase 3 | Handle disconnections gracefully | PARTIAL: ElevenLabs handles reconnection at transport level; we handle UX and conversation state |
| Cost monitoring and caps | Phase 3/9 | Per-conversation and monthly budget tracking | We build: track via ElevenLabs usage API + our own counters |
| Audio recording for compliance | Phase 3 | Optional audio storage for 20-year retention | We build: post-call audio webhook -> Supabase Storage |

### 3.3 LLM Integration Options

ElevenLabs Conversational AI supports multiple LLM configurations:

| Option | Description | Best For |
|--------|-------------|----------|
| **Built-in LLMs** | Select from supported models (GPT-4o, GPT-4o-mini, Claude, Gemini, etc.) directly in agent config | Simplest setup; good for MVP |
| **Bring Your Own API Key** | Use your OpenAI/Anthropic key so usage bills to your account | Cost control and existing API agreements |
| **Custom LLM Server** | Point agent to your own OpenAI-compatible endpoint | Maximum control; run your own medical LLM; LGPD-friendly if hosted in Brazil |

**Recommendation for medical use:** Start with Built-in LLM (GPT-4o-mini or Claude) for rapid prototyping. For production, consider Custom LLM Server pointed at our own endpoint that wraps an LLM API -- this gives us logging, guardrails, and LGPD control over the text data flow.

---

## 4. Vendor Risk Analysis

**Section Confidence: LOW (predicting startup trajectory is inherently uncertain)**

### 4.1 Company Stability

| Metric | Value | Assessment |
|--------|-------|------------|
| Valuation | $11B (Feb 2026) | Strong -- one of the highest-valued AI startups |
| ARR | $330M (2025) | Very strong revenue; 175% YoY growth |
| Total funding | $850M | Well-capitalized |
| Key investors | Nvidia, Lightspeed | Tier-1 investors with strategic interest (Nvidia for AI infra) |
| IPO trajectory | Reported to be eyeing IPO | Positive signal for long-term stability |
| Revenue diversification | Enterprise customers include Deutsche Telekom, Revolut | Diverse customer base, not dependent on single vertical |

**Assessment:** ElevenLabs is one of the most stable AI startups. Bankruptcy risk is LOW in the 2-3 year horizon. However, product direction changes, pricing changes, and feature deprecation are MEDIUM risks with any VC-backed company.

### 4.2 What If ElevenLabs Raises Prices?

Current pricing: ~$0.10/minute (Creator/Pro), ~$0.08/minute (Business annual). Enterprise pricing is custom.

**Cost modeling for our use case:**

| Scenario | Conversations/day | Avg duration | Monthly cost (at $0.10/min) |
|----------|-------------------|-------------|----------------------------|
| Early (MVP) | 10 | 10 min | $300 |
| Growth | 50 | 12 min | $1,800 |
| Scale | 200 | 15 min | $9,000 |
| High scale | 500 | 15 min | $22,500 |

**Note:** These costs do NOT include the LLM cost component. ElevenLabs currently absorbs LLM costs but has stated they will eventually pass these through.

**Mitigation:**
- Enterprise agreement with locked pricing for 1-2 years
- Architectural abstraction layer: our code interfaces with ElevenLabs via a thin wrapper, making it possible to swap
- Monitor cost-per-conversation and set alerts

### 4.3 What If ElevenLabs Discontinues Conversational AI?

This is unlikely given their $11B valuation partly driven by the Conversational AI product. However, if it happens:

**Migration path:**
1. **Fastest alternative (1-2 weeks):** Vapi.ai -- similar managed conversational AI platform. Supports React SDK, multiple STT/TTS providers. Would require reconfiguring the agent but minimal code changes.
2. **Medium-term alternative (2-4 weeks):** Retell AI -- more healthcare-focused, better compliance posture for regulated industries.
3. **Full-control alternative (4-8 weeks):** LiveKit Agents + Deepgram STT + ElevenLabs TTS (standalone) or OpenAI TTS. Requires building the orchestration ourselves but gives maximum control.
4. **Nuclear option (6-12 weeks):** Return to the composed pipeline from the original research (Deepgram + GPT-4o-mini + OpenAI TTS + custom WebSocket server).

### 4.4 Lock-In Depth Assessment

| Component | Lock-in Level | Mitigation |
|-----------|---------------|------------|
| **TTS voice** | HIGH -- custom ElevenLabs voices cannot be migrated | Use standard voices, not cloned ones; voice branding is portable conceptually |
| **Agent configuration** | MEDIUM -- system prompt and tools are portable concepts; specific API format is not | Keep system prompt and tool definitions in our repo, not just in ElevenLabs dashboard |
| **Conversation data** | LOW -- we store everything in Supabase via webhooks | No lock-in if webhooks are properly implemented |
| **React SDK** | LOW -- `useConversation()` hook is a thin wrapper; can be replaced | Isolate SDK usage behind our own hook/component |
| **STT quality** | LOW -- Scribe v2 is excellent but Deepgram/Google are viable alternatives | No proprietary STT dependency |
| **WebRTC transport** | LOW -- standard WebRTC/WebSocket protocols | Transport layer is easily replaceable |

**Overall lock-in: MEDIUM.** The deepest lock-in is on TTS voice quality/identity. Everything else is architecturally portable.

### 4.5 Competitor Landscape

| Competitor | Strengths | Weaknesses vs ElevenLabs |
|-----------|-----------|-------------------------|
| **Vapi.ai** | Omnichannel (phone, web, SMS), provider-agnostic, good latency | Not telephony-native for web; less control over TTS quality |
| **Retell AI** | Healthcare focus, compliance features, call handling precision | Smaller company; less TTS quality; designed more for call centers |
| **Bland AI** | No-code builder, outbound SDR focus, summarization | Not healthcare-oriented; less mature |
| **OpenAI Realtime API** | Best medical comprehension (native GPT-4o), lowest latency | 60-min limit, highest cost, total vendor lock-in, no voice variety |
| **LiveKit + Agents** | Open-source, self-hostable (LGPD ideal), Apache 2.0 | Python-based agents, more engineering effort, no managed option for voice |
| **Pipecat** | Open-source voice AI framework, many integrations | Python-based, no managed hosting, more DIY |

---

## 5. Security Analysis

**Section Confidence: HIGH**

### 5.1 Connection Security

| Layer | Protection |
|-------|------------|
| **Browser to ElevenLabs** | WebRTC (DTLS/SRTP encryption) or WebSocket over TLS (wss://) |
| **API key exposure** | API key NEVER sent to browser. Server generates signed URL (15-min expiry) or conversation token. Client uses only the short-lived token. |
| **Audio encryption in transit** | TLS 1.2+ (WebSocket) or DTLS (WebRTC). All audio encrypted. |
| **Audio encryption at rest** | AES-256 encryption at rest (per SOC 2 / ISO 27001 compliance) |
| **API authentication** | xi-api-key header (server-side only), scoped API keys with permissions |

### 5.2 Authentication Flow for Our App

```
Patient Browser                   Our Next.js Server              ElevenLabs API
     |                                   |                              |
     |-- 1. Login (Supabase Auth) ------>|                              |
     |<-- JWT token -------------------- |                              |
     |                                   |                              |
     |-- 2. Request voice session ------>|                              |
     |   (with Supabase JWT)             |                              |
     |                                   |-- 3. Verify JWT (Supabase) -->|
     |                                   |-- 4. Request signed URL ----->|
     |                                   |   (with xi-api-key)           |
     |                                   |<-- Signed URL (15min) --------|
     |<-- Signed URL ------------------- |                              |
     |                                   |                              |
     |-- 5. Connect WebSocket/WebRTC directly to ElevenLabs ----------->|
     |   (using signed URL)              |                              |
     |<-- Voice conversation ----------->|                              |
```

**Key security properties:**
- API key never leaves our server
- Signed URL expires in 15 minutes (session can continue longer once established)
- Patient must be authenticated with Supabase before getting a signed URL
- Our server can enforce role checks (only patients with `patient` role get signed URLs)
- Our server can enforce consent checks (only patients who signed LGPD consent get access)

### 5.3 Certifications and Audits

| Certification | Status | Auditor |
|---------------|--------|---------|
| SOC 2 Type II | Certified (zero exceptions) | Insight Assurance |
| ISO 27001 | Certified | -- |
| PCI DSS Level 1 | Certified | -- |
| HIPAA | Attestation + BAA available (Enterprise) | -- |
| GDPR | Compliant | -- |
| Penetration testing | Part of SOC 2 audit cycle | -- |

### 5.4 Webhook Security

Post-call webhooks support HMAC signature verification:
- Shared secret generated on webhook creation
- `ElevenLabs-Signature` header included in each webhook request
- SDK provides verification helper

**Our implementation must:** Verify HMAC signature on every webhook before processing. Never trust unverified webhook data for medical records.

---

## 6. Comparison: ElevenLabs-Centric vs Previous Composed Pipeline

**Section Confidence: HIGH**

| Aspect | Composed Pipeline (Deepgram + GPT-4o-mini + OpenAI TTS) | ElevenLabs Conversational AI |
|--------|-------------------------------------------------------|------------------------------|
| **Architecture complexity** | HIGH -- Custom WebSocket server, 3 separate service connections, audio routing, session management | LOW -- Single SDK, one connection, managed orchestration |
| **LGPD risk** | HIGH -- Audio flows to 3 separate US-based vendors (Deepgram, OpenAI x2); 3 DPAs needed; 3 data flows to map | MEDIUM -- Audio flows to 1 vendor (ElevenLabs); 1 DPA; 1 data flow. Still international transfer but simpler to manage |
| **Cost per 10-min conversation** | ~$0.14-0.40 (STT $0.077 + TTS $0.075 + LLM $0.03-0.20 + server hosting amortized) | ~$1.00-1.50 (at $0.10/min + future LLM passthrough). **2-5x more expensive** |
| **pt-BR TTS quality** | GOOD -- OpenAI gpt-4o-mini-tts is decent but ranked 4th for pt-BR per Research B | EXCELLENT -- ElevenLabs is the industry leader for TTS; best pt-BR voices and naturalness |
| **pt-BR STT accuracy** | GOOD -- Deepgram Nova-3 Tier 2 (7-16% WER) for pt-BR | EXCELLENT -- Scribe v2: 3.1% WER on Portuguese FLEURS benchmark |
| **Vendor lock-in** | LOW -- Each component swappable independently | MEDIUM -- Single vendor for STT+TTS+transport; TTS voice is the deepest lock-in |
| **Deployment simplicity** | POOR -- Next.js on Vercel + separate WS server elsewhere; CORS, two deployment pipelines | EXCELLENT -- Client-side SDK; no persistent server; fully Vercel-compatible |
| **Customization flexibility** | HIGH -- Full control over every component, audio format, processing logic | MEDIUM -- Configurable but within ElevenLabs' parameters; custom LLM option helps |
| **Medical term accuracy** | MEDIUM -- Deepgram keyword prompting helps but limited; LLM adds context | HIGH -- Scribe v2 combined with LLM understanding; better end-to-end accuracy |
| **Turn detection quality** | MEDIUM -- @ricky0123/vad-web is good but threshold-based; no semantic understanding | HIGH -- Built-in VAD with configurable sensitivity; WebRTC-grade AEC |
| **Development time to MVP** | 4-8 weeks -- Custom WS server, audio pipeline, VAD integration, error handling, AEC | 1-3 weeks -- SDK integration, agent config, webhook handler, UI components |
| **Echo cancellation** | UNCERTAIN -- Browser AEC with documented quirks; contradictory advice in research | STRONG -- WebRTC-native AEC, "battle-tested across billions of video calls" |
| **Barge-in support** | COMPLEX -- Requires careful AEC + VAD coordination; unresolved in research | BUILT-IN -- Managed by platform; configurable interruption behavior |
| **Testing infrastructure** | NONE -- Must build from scratch | GOOD -- Conversation Simulation API, agent testing, CI/CD integration |
| **Production readiness** | LOW -- Custom server needs monitoring, scaling, health checks, process management | HIGH -- Managed infrastructure, auto-scaling, global edge deployment |

---

## 7. Action Items Resolution Matrix

**Section Confidence: HIGH**

| # | DA Action Item | ElevenLabs Resolution | Status | Remaining Work |
|---|---|---|---|---|
| **1** | Sample rate conflict (16kHz vs 24kHz) | **FULLY RESOLVED** -- ElevenLabs handles all sample rate conversion internally. Scribe v2 supports PCM 8-48kHz. WebRTC handles media negotiation. We never touch raw audio formats. | CLOSED | None |
| **2** | LGPD analysis for audio data | **PARTIALLY RESOLVED** -- Consolidated to 1 vendor (simpler), DPA with Brazil SCCs available, HIPAA BAA available, Zero Retention option exists | OPEN | Must: sign Enterprise DPA, conduct RIPD, update consent form, engage legal counsel |
| **3** | Deployment architecture conflict (Vercel + WS server) | **FULLY RESOLVED** -- No WebSocket server needed. ElevenLabs SDK runs client-side. Signed URL generation is a simple API route (works in Vercel serverless). No persistent server process required. | CLOSED | None |
| **4** | WebSocket authentication gap | **FULLY RESOLVED** -- Signed URL pattern: our server verifies Supabase JWT, then requests signed URL from ElevenLabs. Patient never sees API key. 15-minute URL expiry. | CLOSED | Build the signed URL API route with JWT verification |
| **5** | STT accuracy for pt-BR medical terms | **SIGNIFICANTLY IMPROVED** -- Scribe v2: 3.1% WER on Portuguese (FLEURS). Better than Deepgram Nova-3 Tier 2. Still needs real-world validation with medical vocabulary. | MOSTLY CLOSED | Run accuracy test with medical Portuguese audio samples (still recommended but less critical) |
| **6** | AEC / barge-in / playback | **FULLY RESOLVED** -- WebRTC-native echo cancellation. Barge-in is a platform feature. No AudioContext vs `<audio>` element contradiction to resolve. No custom playback queue needed. | CLOSED | None |
| **7** | Evaluate LiveKit | **SUPERSEDED** -- ElevenLabs provides the same benefits LiveKit would (managed transport, WebRTC, no custom server) plus integrated STT/TTS/LLM. LiveKit remains a valid fallback if we leave ElevenLabs. | CLOSED | Keep LiveKit as documented fallback option |
| **8** | Testing strategy | **PARTIALLY RESOLVED** -- ElevenLabs offers Conversation Simulation API, agent testing, CI/CD integration for testing agent behavior. Does NOT cover UI testing, browser compatibility, or accessibility testing. | PARTIALLY OPEN | Build UI testing (Playwright), define browser compatibility matrix, add accessibility tests |
| **9** | Cost monitoring | **PARTIALLY RESOLVED** -- ElevenLabs provides Usage Analytics Dashboard with per-agent, per-period metrics, cost tracking, and API access to usage data. | MOSTLY CLOSED | Set up cost alerts, implement per-user usage caps in our server, monitor LLM cost pass-through |
| **10** | Emergency button behavior | **NOT ADDRESSED** -- ElevenLabs provides no emergency handling. This is entirely our responsibility. | OPEN | Design: display "Ligue 192 (SAMU)" prominently, save partial transcript, provide offline-capable emergency instructions |
| **11** | Architecture diagram reconciliation | **FULLY RESOLVED** -- No contradiction between WS routes and API routes. Architecture is simple: Client SDK -> ElevenLabs Cloud. Our server only provides signed URLs and handles webhooks. | CLOSED | Create updated architecture diagram |
| **12** | VAD model download size (7-10 MB) | **FULLY RESOLVED** -- No client-side VAD model needed. ElevenLabs handles VAD server-side. Zero additional download for the patient. | CLOSED | None |

**Summary: 7 CLOSED, 3 PARTIALLY OPEN, 2 OPEN**

---

## 8. Remaining Open Questions from Previous Research

### 8.1 From Research A (Audio Capture & Streaming)

| # | Open Question | Status with ElevenLabs |
|---|---|---|
| 1 | Sample rate negotiation (48kHz capture, 16kHz STT) | **RESOLVED** -- handled by ElevenLabs SDK internally |
| 2 | Barge-in support: allow patient to interrupt AI? | **RESOLVED** -- configurable in agent settings; recommended: enable for medical UX |
| 3 | WebSocket server deployment location | **RESOLVED** -- no WS server needed; signed URL API route on Vercel |
| 4 | Audio recording for compliance (CFM) | **OPEN** -- ElevenLabs provides post-call audio webhook; we need to decide if we store audio and implement the webhook handler |
| 5 | Opus encoding value (bandwidth savings) | **RESOLVED** -- handled by ElevenLabs SDK; we do not manage encoding |
| 6 | AudioWorklet file serving in Next.js | **RESOLVED** -- no AudioWorklet needed; SDK handles audio capture |
| 7 | Multi-tab behavior | **PARTIALLY OPEN** -- ElevenLabs SDK likely handles one session per page; we should still detect and block multi-tab triage |

### 8.2 From Research B (STT & TTS Services)

| # | Open Question | Status with ElevenLabs |
|---|---|---|
| 1 | STT accuracy validation for medical Portuguese | **STILL RECOMMENDED** but less critical -- Scribe v2 has better baseline (3.1% WER) than Deepgram |
| 2 | TTS voice selection for medical context | **IMPROVED** -- ElevenLabs has the most pt-BR voices; select and test during agent configuration |
| 3 | Deepgram vs Google for accent coverage | **RESOLVED** -- using Scribe v2 which supports Brazilian accents including Sao Paulo, Rio, Northeastern, etc. |
| 4 | DPA verification for each service | **SIMPLIFIED** -- only 1 DPA needed (ElevenLabs) instead of 3 (Deepgram + OpenAI x2) |
| 5 | Cost at scale modeling | **OPEN** -- ElevenLabs is 2-5x more expensive than composed pipeline; need Enterprise pricing negotiation |

### 8.3 From Research C (VAD & UI Patterns)

| # | Open Question | Status with ElevenLabs |
|---|---|---|
| 1 | Optimal silence threshold for medical conversations | **PARTIALLY RESOLVED** -- ElevenLabs VAD is configurable; test with medical conversations during agent setup |
| 2 | CSS orb vs Lottie vs Canvas for voice visualization | **STILL OPEN** -- we still build the UI; same decision needed |
| 3 | Accessibility: screen reader interaction with voice UI | **STILL OPEN** -- we build the UI; ARIA live regions still needed |
| 4 | Client-side audio buffering for LGPD (local save) | **RESOLVED** -- no client-side buffering needed; ElevenLabs manages audio lifecycle |
| 5 | Dynamic silence threshold per question type | **OPEN** -- could potentially be configured via ElevenLabs agent tools or mid-conversation settings |

---

## 9. Recommendations

### 9.1 Immediate Actions (Before Any Code)

1. **Contact ElevenLabs Enterprise sales** to discuss:
   - Enterprise tier pricing for healthcare
   - BAA execution
   - DPA with Brazil SCCs
   - Data residency options (request Brazil if available)
   - Zero Retention Mode configuration
   - Custom LLM server support specifics

2. **Update Phase 2 consent form** to include:
   - Explicit mention that voice data is transmitted to ElevenLabs Inc. servers in the US/EU
   - Specific consent for international data transfer per LGPD Art. 33
   - Information about what data is retained (transcript) and what is not (audio, if using Zero Retention)
   - Patient rights regarding their voice data

3. **Conduct RIPD (Data Protection Impact Assessment)** covering:
   - Data flow: patient browser -> ElevenLabs (US/NL) -> webhook -> our Supabase
   - Risk analysis for international transfer of health audio data
   - Technical and organizational security measures
   - Necessity and proportionality assessment

### 9.2 Architecture Decisions

1. **Use ElevenLabs Conversational AI as primary voice platform** on Enterprise tier with HIPAA BAA.
2. **Enable Zero Retention Mode** for audio -- audio is not stored by ElevenLabs after processing.
3. **Implement post-call webhooks** to capture transcripts, structured data, and optionally audio into Supabase.
4. **Use signed URL authentication** pattern with Supabase JWT verification.
5. **Keep system prompt and agent configuration in our repository** (version-controlled), not solely in ElevenLabs dashboard.
6. **Build a thin abstraction layer** over ElevenLabs SDK to enable future vendor migration.

### 9.3 Fallback Strategy

Document and maintain awareness of the migration path:
1. **Level 1 (1-2 weeks):** Migrate to Vapi.ai or Retell AI (similar managed platform)
2. **Level 2 (4-8 weeks):** Migrate to LiveKit + Deepgram + ElevenLabs TTS (self-orchestrated)
3. **Level 3 (6-12 weeks):** Full composed pipeline (original research architecture)

### 9.4 Cost Management

1. Negotiate Enterprise pricing (target: <$0.08/min including LLM)
2. Implement per-user daily conversation limits
3. Set monthly cost alerts at 50%, 80%, and 100% of budget
4. Track cost-per-conversation metric in our analytics
5. Monitor ElevenLabs announcements for LLM cost pass-through timing

---

## 10. Open Questions

These require answers before or during implementation:

| # | Question | Owner | Priority |
|---|----------|-------|----------|
| 1 | What is ElevenLabs Enterprise pricing for healthcare use case? | Project Lead | P0 |
| 2 | Can ElevenLabs execute a DPA with explicit Brazil SCCs? | Legal/Project Lead | P0 |
| 3 | Should we store audio recordings for CFM compliance, or is transcript sufficient? | Legal Counsel | P0 |
| 4 | What LLM should the agent use -- built-in GPT-4o-mini, or custom LLM server? | Tech Lead | P1 |
| 5 | What is the emergency button behavior (call 192, display instructions, alert operator)? | Product/Medical | P1 |
| 6 | What CSS animation approach for the voice orb (CSS/Tailwind vs Lottie)? | Frontend/Design | P2 |
| 7 | Do we need to update the `consent_records` table schema for voice-specific consent? | Backend | P1 |
| 8 | What browser compatibility matrix do we target (minimum iOS/Android versions)? | Product | P1 |
| 9 | Does Resolution CFM 2431/2025 (AI in medicine) create new requirements for us? | Legal | P1 (monitor) |
| 10 | Can we negotiate data residency in Brazil or LATAM with ElevenLabs? | Project Lead | P2 |

---

## 11. Sources

### ElevenLabs Official Documentation
- [ElevenLabs Privacy Policy](https://elevenlabs.io/privacy-policy)
- [ElevenLabs Data Processing Addendum (DPA)](https://elevenlabs.io/dpa)
- [ElevenLabs Trust Center / Compliance Portal](https://compliance.elevenlabs.io/)
- [ElevenLabs Data Residency](https://elevenlabs.io/docs/overview/administration/data-residency)
- [ElevenLabs EU-US Data Privacy Framework Policy](https://elevenlabs.io/eu-us-data-privacy-framework-policy)
- [ElevenLabs Conversational AI Terms](https://elevenlabs.io/agents-terms)
- [ElevenLabs Zero Retention Mode](https://elevenlabs.io/docs/developers/resources/zero-retention-mode)
- [ElevenLabs Retention Settings](https://elevenlabs.io/docs/agents-platform/customization/privacy/retention)
- [ElevenLabs Audio Saving](https://elevenlabs.io/docs/agents-platform/customization/privacy/audio-saving)
- [ElevenLabs HIPAA Compliance](https://elevenlabs.io/docs/agents-platform/legal/hipaa)
- [ElevenLabs Agent Authentication](https://elevenlabs.io/docs/agents-platform/customization/authentication)
- [ElevenLabs React SDK](https://elevenlabs.io/docs/agents-platform/libraries/react)
- [ElevenLabs WebSocket API](https://elevenlabs.io/docs/agents-platform/libraries/web-sockets)
- [ElevenLabs Custom LLM Integration](https://elevenlabs.io/docs/agents-platform/customization/llm/custom-llm)
- [ElevenLabs Post-Call Webhooks](https://elevenlabs.io/docs/agents-platform/workflows/post-call-webhooks)
- [ElevenLabs Conversation Analysis](https://elevenlabs.io/docs/agents-platform/customization/agent-analysis)
- [ElevenLabs Usage Analytics](https://elevenlabs.io/docs/overview/administration/usage-analytics)
- [ElevenLabs Conversation Simulation](https://elevenlabs.io/docs/agents-platform/guides/simulate-conversations)
- [ElevenLabs Agent Testing](https://elevenlabs.io/docs/agents-platform/customization/agent-testing)
- [ElevenLabs Introducing European Data Residency](https://elevenlabs.io/blog/introducing-european-data-residency)
- [ElevenLabs WebRTC Support](https://elevenlabs.io/blog/conversational-ai-webrtc)
- [ElevenLabs Scribe v2 Realtime](https://elevenlabs.io/blog/introducing-scribe-v2-realtime)
- [ElevenLabs Data Training FAQ](https://help.elevenlabs.io/hc/en-us/articles/29952728805393-Is-my-data-used-to-improve-ElevenLabs-AI-models)
- [ElevenLabs Conversational AI Pricing](https://elevenlabs.io/blog/we-cut-our-pricing-for-conversational-ai)
- [ElevenLabs API Pricing](https://elevenlabs.io/pricing/api)
- [ElevenLabs Enterprise](https://elevenlabs.io/enterprise)
- [ElevenLabs PCM Output Format](https://elevenlabs.io/blog/pcm-output-format)
- [ElevenLabs Conversation Details API](https://elevenlabs.io/docs/agents-platform/api-reference/conversations/get)
- [ElevenLabs Delete Conversation API](https://elevenlabs.io/docs/api-reference/conversations/delete)
- [ElevenLabs SOC 2 Type II Announcement](https://www.linkedin.com/posts/elevenlabsio_elevenlabs-is-now-soc2-type-2-certified-with-activity-7160625911527075840-X_KE)

### ElevenLabs Company / Financial
- [CNBC: ElevenLabs $11B Valuation (Feb 2026)](https://www.cnbc.com/2026/02/04/nvidia-backed-ai-startup-elevenlabs-11-billion-valuation.html)
- [ElevenLabs Series C Announcement ($180M)](https://elevenlabs.io/blog/series-c)
- [ElevenLabs Wikipedia](https://en.wikipedia.org/wiki/ElevenLabs)
- [Sacra: ElevenLabs Revenue Analysis](https://sacra.com/c/elevenlabs/)

### Competitor Analysis
- [ElevenLabs vs Vapi.ai](https://elevenlabs.io/blog/elevenlabs-vs-vapiai)
- [Retell AI vs ElevenLabs](https://www.retellai.com/comparisons/retell-vs-elevenlabs)
- [Vapi vs ElevenLabs (Ringly)](https://www.ringly.io/comparison/vapi-vs-elevenlabs-conversational-ai)
- [Voice Agent Platforms Compared (Softcery)](https://softcery.com/lab/choosing-the-right-voice-agent-platform-in-2025)
- [ElevenLabs Alternatives (Famulor)](https://www.famulor.io/blog/top-10-elevenlabs-alternatives-for-conversational-ai-a-comprehensive-comparison)

### STT Comparison
- [ElevenLabs Portuguese Speech to Text](https://elevenlabs.io/speech-to-text/portuguese)
- [Deepgram vs ElevenLabs](https://deepgram.com/learn/deepgram-vs-elevenlabs)
- [Top 6 STT Solutions 2026 (Fingoweb)](https://www.fingoweb.com/blog/top-6-speech-to-text-ai-solutions-in-2026/)

### LGPD and Brazilian Regulation
- [LGPD Full Text (Planalto)](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [LGPD Art. 33 Analysis](https://lgpd-brasil.info/capitulo_05/artigo_33)
- [LGPD Art. 33 Practical Guide (Magrathea Labs)](https://lgpd.magrathealabs.com/cap5-art-33/)
- [Brazil Data Protection Laws Report 2025-2026 (ICLG)](https://iclg.com/practice-areas/data-protection-laws-and-regulations/brazil)
- [Brazil LGPD SaaS Guide (ComplyDog)](https://complydog.com/blog/brazil-lgpd-complete-data-protection-compliance-guide-saas)
- [FGV International Data Transfer Guide (PDF)](https://portal.fgv.br/sites/default/files/uploads/2024-06/2023.10.23._guia_de_transferencia_internacional_.pdf)

### CFM / Medical Regulation
- [Resolution CFM 2.314/2022 (Full Text)](https://sistemas.cfm.org.br/normas/arquivos/resolucoes/BR/2022/2314_2022.pdf)
- [Resolution CFM 2.314/2022 (Visualization)](https://sistemas.cfm.org.br/normas/visualizar/resolucoes/BR/2022/2314)
- [CFM AI Resolution in Progress](https://portal.cfm.org.br/noticias/cfm-avanca-na-elaboracao-de-resolucao-sobre-uso-da-inteligencia-artificial-na-medicina/)
- [CFM AI Resolution Risk Classification](https://futurodasaude.com.br/resolucao-de-ia-do-cfm/)
- [CFM Resolution 2431/2025 (PDF)](https://sistemas.cfm.org.br/normas/arquivos/resolucoes/BR/2025/2431_2025.pdf)
- [CFM AI Software Approval Criteria 2025](https://www.klinity.com/blog/cfm-aprovacao-software-ia-medicina)
- [Brazil Joins Health AI International Organization](https://med.estrategia.com/portal/noticias/brasil-firma-acordo-internacional-para-regulamentar-uso-de-inteligencia-artificial-na-saude/)
- [AI and Digital Health in Brazil (IBA)](https://www.ibanet.org/ai-digital-health-brazil)

### Testing and Evaluation
- [ElevenLabs Testing Blog](https://elevenlabs.io/blog/testing-conversational-ai-agents)
- [ElevenLabs Tests for Agents](https://elevenlabs.io/blog/tests-for-elevenlabs-agents)
- [Promptfoo: Evaluating ElevenLabs Voice AI](https://www.promptfoo.dev/docs/guides/evaluate-elevenlabs/)

### Previous Research (This Project)
- [03-RESEARCH-A-audio.md](./03-RESEARCH-A-audio.md) -- Audio Capture & Streaming
- [03-RESEARCH-B-stt-tts.md](./03-RESEARCH-B-stt-tts.md) -- STT & TTS Services
- [03-RESEARCH-C-vad-ui.md](./03-RESEARCH-C-vad-ui.md) -- VAD & UI Patterns
- [03-RESEARCH-REVIEW.md](./03-RESEARCH-REVIEW.md) -- Devil's Advocate Review
