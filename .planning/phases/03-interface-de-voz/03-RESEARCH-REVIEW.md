# Research Review: Devil's Advocate Analysis

**Reviewer:** Devil's Advocate Agent
**Date:** 2026-02-08
**Documents Reviewed:** 03-RESEARCH-A (Audio Capture & Streaming), 03-RESEARCH-B (STT & TTS Services), 03-RESEARCH-C (VAD & Voice UI)

---

## Executive Summary

The three research documents are individually well-written, thorough, and cite credible sources. However, when read together as a coherent plan for building a medical voice triage system, **several serious issues emerge**: contradictions on fundamental technical choices (sample rate, WebSocket architecture, VAD approach), critical gaps in LGPD compliance analysis for audio data, no testing strategy whatsoever, an unrealistic deployment plan that ignores the Vercel constraint in the project's own roadmap, and cost estimates that hide significant multipliers.

The research is strong on the "what" (technology options) but weak on the "how" (practical integration into the existing Next.js + Supabase stack) and nearly silent on the "what if" (failure scenarios in a medical context). The team is at risk of building an architecturally elegant system that cannot be deployed to their chosen platform, may violate LGPD requirements, and has no plan for when things go wrong during a patient conversation.

**Overall assessment: 7/10 for individual research quality, 5/10 for cross-document coherence, 3/10 for production readiness.**

The research should NOT be used as-is for planning. The contradictions and gaps identified below must be resolved first.

---

## 1. Contradictions Between Researchers

### 1.1 Sample Rate: 16kHz vs 24kHz -- The Unresolved Conflict

**Research A** (Section 2.2) identifies 16kHz as the "universal format" and builds the entire AudioWorklet pipeline around it (code samples hardcode `targetSampleRate: 16000`). The PCM processor, chunking calculations, bandwidth estimates (32 KB/s) -- everything assumes 16kHz.

**Research A** also acknowledges (same section) that the OpenAI Realtime API requires 24kHz PCM 16-bit little-endian. This is mentioned as a footnote but not reconciled.

**Research B** (Section 3.6) describes Realtime API integration with "captures mic at 16kHz mono, 20-40ms chunks" -- this is **wrong**. The Realtime API requires 24kHz. If the client sends 16kHz to the Realtime API, audio quality will be degraded or the connection will fail.

**Research C** consistently references 16kHz throughout (e.g., Silero VAD v5 processes "512 samples per frame for v5" at 16kHz).

**The problem:** If the team ever wants to use the OpenAI Realtime API (which Research B recommends as the secondary option), the entire audio pipeline needs to capture at 24kHz, not 16kHz. But `@ricky0123/vad-web` and Silero VAD expect 16kHz input. This means either:
- Capture at 48kHz (native) and resample to BOTH 16kHz (for VAD + Deepgram) and 24kHz (for Realtime API), or
- Pick one path and abandon the other.

**No researcher addresses this fundamental incompatibility.** The "we recommend the composed pipeline but prototype the Realtime API" advice is impractical unless the audio pipeline is explicitly designed for multi-rate output.

### 1.2 WebSocket Architecture: Who Hosts It?

**Research A** (Section 3.2) recommends Option A: a **separate WebSocket server** (Node.js + `ws` library on port 3001) alongside Next.js. The code sample in Section 7.5 implements this as a standalone `server/ws-audio-server.ts`.

**Research B** (Section 4.3) shows the architecture diagram with `[/api/voice/stream]` as a Next.js API route handling WebSocket -- which Research A explicitly says **does not work** ("Next.js Route Handlers do not support WebSocket upgrade requests"). Research B's diagram contradicts Research A's core finding.

**Research B** (Section 4.1) references "Next.js API Route (WebSocket proxy)" for Deepgram integration. Again, this implies WebSocket handling inside Next.js routes, which is not supported.

**The contradiction is never acknowledged.** Research B draws architectures that Research A's own analysis says are impossible without patching.

### 1.3 VAD: Client-Side vs Server-Side -- Which Is It?

**Research A** (Section 4.1, pipeline diagram) shows VAD running as a parallel branch off the `MediaStreamSourceNode`, using `@ricky0123/vad`. The VAD triggers `onSpeechEnd` which sends chunks.

**Research C** (Section 1.6) describes OpenAI Realtime API's server-side semantic VAD as potentially the "strongest option for medical turn detection" and recommends it if the Realtime API is chosen. But this conflicts with the pipeline in Research A, which assumes client-side VAD feeds discrete audio segments to a STT service.

**The problem:** If using Realtime API with server-side VAD, the client should stream ALL audio continuously (not VAD-gated segments). But if using the composed pipeline with client-side VAD, the client sends segmented speech. These are fundamentally different client architectures. Research A's pipeline code would need significant modification for the Realtime API path.

**No researcher explicitly maps "if we choose approach X, then the client pipeline looks like THIS; if approach Y, then THAT."**

### 1.4 Audio Playback: Web Audio API vs `<audio>` Element

**Research A** (Section 6.4, point 4) recommends using the `<audio>` HTML element for TTS playback because "Chromium's AEC works better when playback goes through an `<audio>` element rather than directly through `AudioContext.destination`."

**Research A** (Section 7.4) then provides a `AudioPlaybackQueue` class that plays TTS audio through `AudioContext.destination` -- the exact approach it just said NOT to use for AEC compatibility.

This is a direct self-contradiction within Research A.

### 1.5 Barge-In Approach Mismatch

**Research A** (Section 6.4) suggests "Mute microphone during TTS playback (secondary)" as a fallback strategy, noting it "prevents barge-in."

**Research C** (Section 2.6) recommends "Immediate Barge-In (Recommended)" as Strategy A, which requires the microphone to be active during TTS playback.

These are not contradictory in the sense that both acknowledge the trade-off, but there is no agreed-upon recommendation. Research A leans toward muting for safety; Research C leans toward barge-in for UX. For a medical application, this decision has patient-safety implications (a patient trying to say "I need help" while the AI talks) and must be resolved explicitly.

### 1.6 TTS Recommendation Divergence

**Research B** recommends **OpenAI gpt-4o-mini-tts** as primary TTS.

**Research B's own pt-BR TTS ranking** (Section 6.4) puts Azure TTS first (13+ pt-BR voices), ElevenLabs second, Google third, and OpenAI fourth ("good pt-BR but no dedicated Portuguese voices").

This means the primary recommendation uses the fourth-ranked option for pt-BR quality. The justification is cost and simplicity, which is fair, but the ranking vs recommendation disconnect should be explicitly acknowledged and justified.

---

## 2. Gaps in Research

### 2.1 LGPD Compliance for Audio Data -- CRITICALLY UNDERANALYZED

This is a healthcare application subject to LGPD. Audio recordings of patients describing medical symptoms are **sensitive personal data** (Art. 5, II and Art. 11 of LGPD). The research treats LGPD as a footnote rather than a first-class constraint.

**Unanswered questions:**

1. **Data Processing Agreements (DPAs):** Which of Deepgram, OpenAI, ElevenLabs have DPAs compatible with LGPD? Where is audio data processed geographically? LGPD requires adequate protection for international transfers (Art. 33). If audio goes to US-based servers, what is the legal basis?

2. **Data retention by third-party services:** When audio is streamed to Deepgram for STT, does Deepgram retain that audio? For how long? The Google Cloud STT pricing page mentions a "data logging opt-out" that costs 40% more -- this implies Google retains audio by default. What about Deepgram and OpenAI?

3. **Audio recording obligation:** Research A (Open Question 4) mentions that CFM regulations "may require storing audio recordings." This should not be an open question -- it should be a researched fact. Resolucao CFM 2.314/2022 has specific requirements for telemedicine documentation. Do these apply to AI-mediated triage? This is a legal question that directly impacts the technical architecture (recording pipeline, storage, retention for 20 years).

4. **Consent granularity:** The patient's LGPD consent (Phase 2) presumably covers data processing. But does it specifically cover streaming voice data to third-party AI services in the US? Patients must be informed of where their data goes and who processes it.

5. **Right of deletion vs 20-year retention:** LGPD guarantees the right to deletion (Art. 18, VI). CFM requires 20-year retention of medical records. How do you reconcile these? If audio is part of the medical record, it cannot be deleted for 20 years. If it is not, it must be deletable on request.

**None of the three research documents adequately address these issues.** Research A mentions it in Open Questions, Research B asks about DPAs in Open Questions, Research C raises client-side audio buffering under LGPD. These should have been CENTRAL findings, not afterthoughts.

### 2.2 Security in Transit -- Insufficient Analysis

**Research A** discusses API key protection (keeping keys server-side) but does not address:
- Audio data in transit between browser and WebSocket server: is it encrypted? WebSocket over `wss://` is TLS-encrypted, but this is never stated.
- Audio data in transit between WebSocket relay and Deepgram/OpenAI: same question.
- Authentication of the WebSocket connection itself: the code sample in Section 7.5 accepts connections with zero authentication. Any client can connect and stream audio. There is no JWT verification, no session token, nothing.
- The separate WebSocket server on port 3001 is a new attack surface. How is it secured? CORS? Rate limiting? Authentication?

**Research B** mentions "All API keys stored as server-side environment variables" and "Rate limiting at the API route level" -- but the WebSocket server is NOT an API route. It is a separate process. Rate limiting strategies for persistent WebSocket connections are fundamentally different from HTTP request rate limiting.

### 2.3 Error Recovery for Long Conversations -- Barely Covered

Research A provides WebSocket reconnection with exponential backoff (Section 6.1). But what about the CONVERSATION state?

- If a 15-minute medical conversation drops at minute 12, the patient has provided extensive medical history. Upon reconnection:
  - Is the STT service's streaming session still alive? (Probably not -- most STT services timeout after 10-30 seconds of no audio.)
  - Does the LLM still have the conversation context? (Only if stored server-side.)
  - Does the TTS queue need to resume from where it was interrupted?
  - Is the patient's already-provided information saved, or do they need to repeat everything?

Research C (Section 3.3, edge case 4) mentions saving state to Supabase, but this is a single sentence. The actual mechanism for mid-conversation recovery -- re-establishing STT streams, restoring LLM context, resuming the triage questionnaire -- is completely undesigned.

For a medical application, this is unacceptable. Patients who are in pain or distress should not be asked to repeat their medical history because the WebSocket dropped.

### 2.4 Testing Strategy -- Completely Absent

None of the three documents mention:
- How to unit test AudioWorklet processors (they run in a different global scope)
- How to integration test the full voice pipeline (mic -> STT -> LLM -> TTS -> speaker)
- How to test with simulated audio input (pre-recorded medical conversations)
- How to validate STT accuracy for Portuguese medical terms
- How to performance test WebSocket connections under load
- How to test on real devices (iOS Safari, Android Chrome)
- Whether there are testing frameworks for voice interfaces (e.g., Playwright audio testing, WebDriver for voice)
- How to create a regression test suite for voice quality

The CLAUDE.md explicitly states "No test framework configured yet." For a medical application, shipping voice features without any testing infrastructure is a significant risk.

### 2.5 Offline / Degraded Network -- Inadequate Coverage

Research B mentions a fallback chain: Deepgram -> Whisper (batch) -> Web Speech API -> text-only mode. But:
- How fast does the system detect a failed service and switch? Is there a health check before each conversation?
- The Web Speech API fallback sends audio to Google's servers (privacy concern flagged in Research B itself) -- so it is not really a privacy-safe fallback.
- What about degraded bandwidth? Mobile users on 3G connections may have enough bandwidth for text but not for real-time audio streaming. The 32 KB/s PCM stream requires at least 256 kbps reliable connectivity. Is there a bandwidth test before starting?
- What happens if the patient is in a rural area of Brazil with spotty connectivity? The system should degrade gracefully, not crash.

### 2.6 Deployment Architecture vs Vercel -- Fundamental Conflict

**The ROADMAP (Phase 9)** specifies deployment to Vercel. **Research A** recommends a separate WebSocket server on port 3001.

Vercel does not support long-running WebSocket servers. Vercel serverless functions have execution time limits (typically 10-60 seconds, up to 300 seconds on Pro). A triage conversation lasting 10-30 minutes CANNOT run on Vercel serverless.

Research A acknowledges this ("If deploying to Vercel, consider Option D (PartyKit)") but does not deeply analyze what this means:
- PartyKit costs money. How much? Not analyzed.
- PartyKit runs on Cloudflare Workers -- is audio data going through Cloudflare acceptable under LGPD?
- If using a separate VPS for the WebSocket server (e.g., Railway, Fly.io, DigitalOcean), the "deploy to Vercel" story becomes "deploy Next.js to Vercel AND deploy the WebSocket server to another provider AND ensure they can communicate AND handle CORS AND maintain two deployment pipelines."

This is a fundamentally different deployment story than "deploy to Vercel" as stated in the roadmap. **No researcher flags this critical disconnect with Phase 9.**

### 2.7 Concurrent Users and Scalability -- Not Addressed

How many simultaneous triage conversations can the WebSocket server handle? Each conversation requires:
- One WebSocket connection to the client
- One WebSocket connection to Deepgram (or other STT service)
- CPU for audio processing (if any server-side processing)
- Memory for session state
- One active LLM request (streaming)
- One active TTS request (streaming)

On a single Node.js instance, how many concurrent sessions are feasible? 10? 100? 1000? What happens during peak hours? This analysis is absent.

### 2.8 Audio Quality Validation Pipeline -- Missing

How does the team know if the STT is accurately transcribing Portuguese medical terms? Research B mentions needing to "run our own evaluation with a curated test set" (Open Question 1) but provides no framework for how to do this. For a medical application, the difference between "dispneia" (dyspnea) and "dispensa" (dismissal) could be clinically significant.

---

## 3. Risk Assessment

### 3.1 Deepgram Nova-3 for pt-BR STT

| Risk Type | Level | Assessment |
|-----------|-------|------------|
| **Technical** | MEDIUM | Good streaming API, strong SDK. Risk: Nova-3 pt-BR is Tier 2 (7-16% WER), meaning 1 in 6 to 1 in 14 words may be wrong. In medical context, this error rate could miscapture symptoms. |
| **Vendor** | MEDIUM | Deepgram is a VC-funded startup (Series B). If they pivot, raise prices, or shut down, the STT component must be replaced. Mitigation: the composed pipeline makes this swappable. |
| **Compliance** | HIGH | Deepgram's data processing practices for LGPD are not verified in the research. Audio data streams to Deepgram's US-based servers. No mention of a Deepgram DPA, data residency options, or LGPD compliance certification. |
| **Cost** | LOW | At $0.0077/min, STT cost is negligible even at scale. The $200 free credit covers ~430 hours of development/testing. |
| **Integration** | LOW | WebSocket-based streaming is well-documented. SDK available. Integrates naturally with the proposed architecture. |

### 3.2 OpenAI gpt-4o-mini-tts for TTS

| Risk Type | Level | Assessment |
|-----------|-------|------------|
| **Technical** | LOW-MEDIUM | Well-established API. Risk: no dedicated Portuguese voices (multilingual voices may have subtle accent issues). The instruction-following feature for empathetic tone is promising but unverified for pt-BR. |
| **Vendor** | LOW | OpenAI is the most stable vendor in this stack. Risk: pricing changes (OpenAI has historically lowered prices, but could add surcharges for medical use). |
| **Compliance** | HIGH | Same as Deepgram -- text of patient symptoms is sent to OpenAI for TTS synthesis. This text contains sensitive health data. Does OpenAI retain this? What is their LGPD position? |
| **Cost** | MEDIUM | TTS is the largest cost component in the composed pipeline ($0.075 of the $0.144/conversation). At scale, 30,000 conversations/month = $2,250/month for TTS alone. Not trivial for a medical startup. |
| **Integration** | LOW | Simple REST API with streaming. Well-documented. |

### 3.3 OpenAI Realtime API (gpt-realtime-mini)

| Risk Type | Level | Assessment |
|-----------|-------|------------|
| **Technical** | MEDIUM-HIGH | All-in-one solution reduces complexity but increases risk of total failure. If the Realtime API has an outage, the ENTIRE voice system is down (no fallback to individual components). The 60-minute session limit is a hard constraint. |
| **Vendor** | HIGH | Complete vendor lock-in. Cannot swap STT, LLM, or TTS independently. OpenAI could change pricing, deprecate the API, or modify behavior without notice. |
| **Compliance** | CRITICAL | ALL patient audio AND text flows through a single OpenAI endpoint. This is the maximum possible data exposure to a single third party. LGPD compliance is not just about transit encryption -- it is about data processing contracts, purpose limitation, and data subject rights. |
| **Cost** | HIGH | $0.65/conversation at current rates. But Research B warns about cost unpredictability from context accumulation. A complex 20-minute medical history could easily cost $2-5 per conversation. At 3,000 conversations/month, that is $6,000-$15,000/month -- potentially 3-7x the estimate. |
| **Integration** | MEDIUM | Requires ephemeral token generation, WebRTC setup, and 24kHz audio (which the rest of the pipeline does not use). Two different client architectures must be maintained if this is the "secondary option." |

### 3.4 @ricky0123/vad-web (Silero VAD)

| Risk Type | Level | Assessment |
|-----------|-------|------------|
| **Technical** | MEDIUM | 7-10 MB initial download is significant on slow mobile connections. Patients in rural Brazil on 3G may wait 10-30 seconds for the ONNX model to load before the triage can begin. The library is at version 0.0.30 -- pre-1.0 means the API may change. |
| **Vendor** | MEDIUM | Open-source (MIT), which is good. But it is maintained by a single developer (@ricky0123). If they stop maintaining it, the team must fork and maintain it themselves. |
| **Compliance** | LOW | VAD runs entirely client-side. Audio does not leave the device for VAD processing. This is the best possible compliance posture. |
| **Cost** | NONE | Free and open-source. |
| **Integration** | LOW-MEDIUM | React hooks available. But: AudioWorklet file serving in Next.js needs attention (Research A, Open Question 6). The ONNX + WASM files need to be served correctly. CDN loading is the default, which means a third-party CDN hosts the model -- another data flow to document for LGPD. |

### 3.5 Separate WebSocket Server

| Risk Type | Level | Assessment |
|-----------|-------|------------|
| **Technical** | MEDIUM | Adds operational complexity. Two processes to monitor, deploy, and scale. Process management (PM2, Docker) needed. Health checks, logging, crash recovery all must be implemented. |
| **Vendor** | LOW | Uses the `ws` npm package (MIT, widely used, well-maintained). |
| **Compliance** | MEDIUM | The WebSocket server processes audio data. Where it is hosted determines data residency. Must be in a region compliant with LGPD requirements. |
| **Cost** | MEDIUM | Requires a VPS or container hosting (not Vercel). Minimum ~$5-20/month for a small VPS, scaling up with concurrent users. |
| **Integration** | HIGH | This is the highest-integration-risk item. Two separate servers need to share authentication state (how does the WS server verify the user's Supabase JWT?). CORS must be configured. Different deployment targets. The code sample in Research A has zero authentication on the WebSocket connection. |

---

## 4. Questionable Assumptions

### 4.1 "AudioWorklet is supported everywhere"

Research A claims AudioWorklet support in Safari 14.1+ / iOS 14.5+. According to Apple's own data (2025), iOS 14 has < 1% market share in Brazil. Most Brazilian users are on iOS 16+. So this is likely fine for iOS.

**However:** The research does not address:
- **Older Android devices:** Brazil has a significant population using budget Android phones with older browser versions. Chrome 66+ is the requirement, but what percentage of Brazilian Android users have Chrome 66+? Probably high (Chrome auto-updates), but it should be verified.
- **In-app browsers:** If a patient receives a link via WhatsApp and opens it in WhatsApp's in-app browser, does AudioWorklet work? WhatsApp WebView on Android uses the system WebView, which may lag behind Chrome. On iOS, WhatsApp WebView is Safari-based and should work.
- **Institutional/kiosk devices:** If this system is deployed in clinics, the devices there may not be modern.

**Recommendation:** The research should include a Brazilian browser usage analysis and define minimum supported browser versions explicitly.

### 4.2 "Browser echo cancellation is sufficient"

Research A acknowledges "AEC needs 2-5s adaptation time" and that Safari's echo cancellation "had bugs." Research C recommends barge-in as the default behavior.

**The reality:** Browser echo cancellation works reasonably well for voice calls between two humans, where both parties rarely speak simultaneously. For an AI triage system where the AI speaks and then immediately listens, the acoustic echo cancellation (AEC) must handle:
- The transition from AI speaking to patient speaking
- Various room acoustics (patients at home, in cars, in noisy environments)
- Different device speakers and microphones (from iPhone 15 to budget Android phone)
- Bluetooth headsets (which add their own processing and latency)

Real-world reports (cited in Research A, DEV Community link) suggest that Web Audio API AEC in Chromium has specific quirks depending on audio routing. The `<audio>` element vs `AudioContext.destination` distinction is critical -- and the code samples contradict the advice.

**For a medical application:** If the AI agent's TTS voice is accidentally captured by the microphone and transcribed as patient speech, it could contaminate the medical record. This is not just a UX issue -- it is a clinical safety issue. The research does not assess the clinical risk of AEC failure.

### 4.3 "PCM 16kHz is the universal format"

It is the universal format for *current* STT services in the *composed pipeline*. But:
- If the team ever wants to use the Realtime API, they need 24kHz.
- If the team ever wants to use WebRTC-based services (which typically use Opus at 48kHz), PCM 16kHz is a downgrade.
- Future STT services may have different requirements.

**The assumption locks the team into a specific architectural path.** This is acceptable if acknowledged, but it should be an explicit, documented decision -- not an implicit assumption.

### 4.4 "$0.14/conversation is cheap"

Research B presents $0.14 per 10-minute conversation as cost-effective. Let us check this against a business reality:

- A medical startup in Brazil is likely operating on thin margins.
- At 100 consultations/day (a modest clinic volume), that is $14/day = $420/month for voice processing alone.
- But consultations may be longer than 10 minutes. A thorough medical history can take 20-30 minutes. At 20 minutes, costs double to $0.28/conversation.
- Peak events (flu season, pandemic) could 5-10x volume temporarily.
- The $0.14 estimate uses Deepgram's pay-as-you-go rate. At 100 conversations/day, the annual audio processed is ~18,250 minutes/month. Deepgram's Growth plan ($4,000/year) kicks in, which is actually cheaper. But this commitment may be premature for a startup.

**The hidden costs not in the $0.14 estimate:**
- LLM cost ($0.03 per conversation) -- this is likely underestimated. A 10-turn medical conversation with a detailed system prompt, conversation history accumulation, and medical terminology could easily cost $0.10-0.20 per conversation with GPT-4o-mini.
- Server hosting for the WebSocket relay: $20-100/month depending on scale.
- Supabase costs (if on Pro plan for production): $25+/month.
- Monitoring, logging, error tracking tools: $20-50/month.

**Realistic total cost per conversation at moderate scale is probably $0.20-0.40, not $0.14.** This should be modeled more carefully.

### 4.5 "1200ms silence threshold is right for medical"

Research C recommends 1200-1500ms based on a table categorizing conversation types. The table cites "well-established in therapeutic/clinical UX research" but provides no specific citation for the 1200ms number in medical triage specifically.

**Concerns:**
- 1200ms is 2-3x the natural human response gap (300-500ms). The AI will feel noticeably slow.
- Elderly patients (common in medical settings) may have even longer pauses. Is 1200ms enough for them?
- Young, tech-savvy patients may find 1200ms annoying.
- Different question types need different thresholds (Research C mentions this in Open Question 5 but does not solve it).

**The real problem:** There is no empirical data. The 1200ms number is an educated guess. It MUST be tested with real Brazilian Portuguese speakers in a medical context before committing to it as a default.

### 4.6 "CSS animated orb is good enough for a medical application"

Research C recommends a CSS/Tailwind animated orb as the MVP visual. The research acknowledges alternatives (Lottie, Canvas, 3D) but dismisses them as "overkill."

**Counter-argument:** This is a medical application, not a chatbot experiment. The visual presentation directly impacts patient trust and comfort. A generic pulsing circle may feel cheap and undermine the credibility of the system. Patients who are anxious about their health need to feel they are interacting with a professional system.

**However:** This is ultimately a design/UX decision, not a technical one. A well-executed CSS animation can look professional. The risk is low if the design is polished. **The real risk is that "MVP" becomes "production" and the orb never gets upgraded.** Recommendation: plan for a post-MVP visual upgrade from the start.

---

## 5. Missing Alternatives

### 5.1 LiveKit

[LiveKit](https://livekit.io/) is an open-source WebRTC infrastructure platform with a dedicated AI voice agent framework (`livekit-agents`). It provides:
- End-to-end WebRTC infrastructure (signaling, TURN, SFU)
- A Python-based `agents` framework with built-in STT/TTS/LLM pipeline management
- React components for voice visualization (`@livekit/components-react`)
- Deepgram, OpenAI, ElevenLabs integrations out of the box
- Self-hostable (LGPD-friendly!) or cloud-hosted (LiveKit Cloud)
- Open-source under Apache 2.0

**Why this matters:** LiveKit solves the WebSocket server problem, the WebRTC signaling problem, the deployment problem, and the audio visualization problem in one package. It is production-grade, used by Spotify, Notion, and others. The `agents` framework provides exactly the STT -> LLM -> TTS pipeline that Research B describes, but pre-built and tested.

**Why it was possibly excluded:** LiveKit Agents is Python-based, which does not fit the Node.js/TypeScript stack. However, the LiveKit server can be deployed separately, and the React client components work perfectly with Next.js. The research references LiveKit twice (once in Research C's sources for audio visualization, once as an example) but never evaluates it as a primary architecture option.

**This is a significant omission.** LiveKit with Deepgram STT + OpenAI TTS + custom LLM agent could provide a faster path to production than building a custom WebSocket server.

### 5.2 Vapi.ai

[Vapi](https://vapi.ai/) is a voice AI platform that provides a fully managed voice agent infrastructure. It handles STT, TTS, LLM orchestration, turn detection, and telephony -- all via a simple API.

**Relevance:** Vapi could eliminate the need for most of Phase 3's custom development. The team would configure a voice agent via Vapi's API and embed it in the React app. Vapi supports Deepgram, OpenAI, ElevenLabs, and custom LLMs.

**Trade-off:** Maximum vendor lock-in and cost, but minimum development time. For an MVP, this could be weeks faster than custom development.

**Why it was possibly excluded:** Vapi is closed-source, US-hosted, and adds another vendor dependency. LGPD compliance would need verification. But it should have been evaluated and rejected with reasoning, not simply omitted.

### 5.3 Pipecat

[Pipecat](https://github.com/pipecat-ai/pipecat) is an open-source Python framework for building voice and multimodal AI agents. It provides:
- Pre-built pipelines for STT -> LLM -> TTS
- Transport layers for WebSocket, WebRTC, Daily.co
- Built-in Deepgram, OpenAI, ElevenLabs integrations
- Interruption handling, turn detection, audio processing

**Similar to LiveKit agents in concept but more focused on the voice AI pipeline.** Same Python-based limitation.

### 5.4 Daily.co

[Daily](https://www.daily.co/) provides WebRTC as a service with a voice AI integration (Bots framework). It handles:
- WebRTC transport
- Audio/video processing
- Integration with Pipecat for voice AI agents

**Relevant because:** It solves the WebSocket/WebRTC server problem without self-hosting.

### 5.5 Local/On-Device STT

**Whisper.cpp / Transformers.js / Whisper Web:**

Running Whisper locally in the browser (via WASM or WebGPU) would eliminate the LGPD concern of sending audio to third parties. Audio never leaves the device.

**Current state (2026):**
- `whisper.cpp` compiled to WASM can run small Whisper models in the browser
- Transformers.js supports Whisper models
- Performance: ~0.5-2x real-time on modern devices for the tiny/base model
- Accuracy: Lower than cloud-based services, especially for medical Portuguese
- Model download: 75MB (tiny) to 1.5GB (large) -- prohibitive for mobile

**For medical use:** The accuracy trade-off is probably not acceptable for production. But for a LGPD-compliant fallback or for development/testing, local STT could be valuable. It was not considered.

### 5.6 Speechmatics

[Speechmatics](https://www.speechmatics.com/) offers enterprise-grade STT with strong multilingual support, including Portuguese. They provide on-premises deployment options, which could be ideal for LGPD compliance. Not mentioned in any research document.

---

## 6. What Could Go Wrong

### 6.1 Patient in Emergency -- Voice System Fails

**Scenario:** A patient experiencing chest pain starts a triage session. Midway through describing symptoms ("Estou com uma dor forte no peito, parece que..."), the WebSocket connection drops due to a network glitch. The system shows "Reconectando..." but the exponential backoff starts at 1 second, then 2, then 4...

Meanwhile, the patient is in distress. The transcript is lost. The emergency button (Research C, Section 6.2) is present but opens... what? A phone number? A static instruction page? Research C does not specify what the emergency button actually does.

**Impact:** Patient safety risk. A medical system that cannot handle network interruption gracefully could delay emergency response.

**Mitigation required:** The emergency button should trigger an immediate, offline-capable action (e.g., display "Ligue 192" / call SAMU). The system should save partial transcripts to local storage immediately, not just on clean session end. WebSocket reconnection during an active conversation should attempt immediately (not backoff), with a visible countdown.

### 6.2 Audio Quality Too Poor for Medical Transcription

**Scenario:** A 65-year-old patient in a noisy household (TV on, family talking) uses a budget Android phone to start triage. The browser's noise suppression helps somewhat, but the STT service receives distorted audio. "Dispneia" (dyspnea) is transcribed as "dispensa" (dismissal). "Cefaleia" (headache) is transcribed as "cafeteira" (coffee maker).

The LLM, working from a corrupted transcript, asks irrelevant follow-up questions. The patient becomes confused and frustrated. The resulting clinical summary is inaccurate.

**Impact:** Clinical safety risk. Inaccurate transcription leads to inaccurate triage.

**Mitigation required:** Confidence scoring for STT results. If confidence is below a threshold, the system should ask the patient to repeat ("Desculpe, nao entendi bem. Poderia repetir?"). Display the transcript in real-time so the patient can see and correct errors. Consider a "corrections" mechanism.

### 6.3 LGPD Audit Finds Non-Compliance

**Scenario:** A data protection authority (ANPD) audits the system and discovers:
- Patient audio is streamed to Deepgram (US-based) without adequate contractual safeguards
- OpenAI's TTS API receives text containing patient symptoms, and OpenAI's terms allow training on API data (unless opted out)
- No Data Processing Impact Assessment (RIPD) was conducted for voice processing
- Audio recordings are not encrypted at rest
- No mechanism exists for patients to access or delete their audio data

**Impact:** LGPD fines up to 2% of revenue or R$50 million per infraction. Reputational damage. Potential shutdown of the service.

**Mitigation required:** Conduct a RIPD before implementation. Obtain DPAs from all service providers. Verify data residency. Implement encryption at rest for any stored audio. Document the data flow for patient transparency. This should be a prerequisite for Phase 3, not an afterthought.

### 6.4 Costs 10x Higher Than Estimated

**Scenario:** The system launches with the Realtime API (secondary recommendation, but the team finds it easier to implement). Initial testing at 10 conversations/day looks fine (~$6.50/day). But:
- Actual conversations average 20 minutes, not 10 (complex medical histories)
- System prompt is 3,000 tokens (medical instructions are verbose)
- Context accumulation over 20 turns makes each turn more expensive
- Actual cost per conversation: $3-5, not $0.65
- User growth reaches 100 conversations/day
- Monthly cost: $9,000-$15,000

The startup cannot sustain this. Switching to the composed pipeline requires 2-4 weeks of re-engineering (different client architecture, WebSocket server, Deepgram integration, TTS integration).

**Impact:** Financial viability risk. Potential project cancellation.

**Mitigation required:** Build the composed pipeline from the start. Use the Realtime API only for prototyping/comparison, never as the production path. Set hard cost alerts and per-user usage caps.

### 6.5 Patient Accent Not Understood by STT

**Scenario:** A patient from the Northeast of Brazil (accent: nordestino) speaks with distinct phonological features (open vowels, different "r" pronunciation, faster cadence). Deepgram Nova-3's pt-BR model, primarily trained on Sao Paulo and Rio accents, has 20-25% WER for this accent instead of the expected 7-16%.

One in four words is wrong. The medical history is garbled. The patient becomes frustrated ("O sistema nao me entende!") and abandons the triage.

**Impact:** Equity and accessibility risk. A system that works well for Sao Paulo but not for Fortaleza is discriminatory in effect.

**Mitigation required:** Test with representative audio samples from all major Brazilian accent groups BEFORE choosing the STT service. Consider Google Cloud STT (largest Portuguese training corpus) as the primary if accent coverage is superior. Document known accent limitations.

### 6.6 WebSocket Server Goes Down During Peak Hours

**Scenario:** The single-instance WebSocket relay server runs out of memory at 150 concurrent connections. All active triage conversations drop simultaneously. The Node.js process crashes without a clean shutdown, losing session state for all conversations.

**Impact:** Service availability risk. Multiple patients lose their triage sessions simultaneously.

**Mitigation required:** Load testing before launch. Process monitoring (PM2 or equivalent). Graceful shutdown with session state persistence. Horizontal scaling plan (even if just "spin up a second instance behind a load balancer"). Memory leak testing for long-running WebSocket connections.

### 6.7 Mobile Safari Breaks Audio in an iOS Update

**Scenario:** Apple releases iOS 19.1 with a WebKit update that changes AudioWorklet behavior (as has happened historically with Safari audio APIs). The VAD stops receiving audio frames. The entire triage system is broken for all iOS users (~30-50% of the user base in Brazil's urban areas).

The team discovers this from user complaints, not from testing. There is no automated browser compatibility test suite. The fix requires understanding an undocumented WebKit change and may take days.

**Impact:** Extended outage for a significant portion of users.

**Mitigation required:** Set up automated browser testing (BrowserStack, Sauce Labs) that runs audio tests against Safari Technology Preview. Subscribe to WebKit bug tracker for Audio API changes. Maintain a text-only fallback that can be activated immediately.

---

## 7. Final Verdict & Recommendations

### 7.1 Composed Pipeline vs OpenAI Realtime API

**Verdict: Build the composed pipeline. Do not invest in the Realtime API for production.**

Reasoning:
1. **Cost control:** The Realtime API's cost unpredictability is unacceptable for a startup. The composed pipeline costs 4-5x less at current rates, and the cost is predictable.
2. **Compliance:** The composed pipeline allows routing specific data to specific services, enabling more granular LGPD compliance. The Realtime API is a single point of maximum data exposure.
3. **Vendor independence:** The composed pipeline allows swapping STT, LLM, or TTS independently. The Realtime API is total vendor lock-in.
4. **Debugging:** When a medical transcription error occurs (and it will), the composed pipeline allows inspecting each stage (was the STT wrong? was the LLM confused? was the TTS garbled?). The Realtime API is a black box.
5. **Session duration:** The Realtime API's 60-minute limit is fine for most triage sessions, but it is a hard constraint that cannot be worked around.
6. **Sample rate incompatibility:** The composed pipeline uses 16kHz throughout, which is simpler. Adding 24kHz support for Realtime API prototyping is extra work with no production benefit.

The Realtime API could be valuable for a quick prototype to demo the concept to stakeholders or investors. But it should not be on the production roadmap.

### 7.2 Is the Current Technology Stack Right?

**Verdict: Mostly yes, with one major caveat.**

The stack (Next.js + React + TypeScript + Supabase + Deepgram + OpenAI TTS) is sound for the application layer. The major problem is the **audio transport layer**: a custom WebSocket server alongside Next.js is operationally complex and conflicts with the Vercel deployment plan.

**Consider seriously:** Adopting LiveKit or a similar WebRTC framework for the audio transport layer. This would:
- Eliminate the need for a custom WebSocket server
- Provide production-grade audio infrastructure out of the box
- Include React components for audio visualization
- Solve the deployment problem (LiveKit Cloud or self-hosted)
- Reduce Phase 3 development time significantly

The trade-off is an additional dependency and potential cost. But the alternative (building, testing, deploying, scaling, and maintaining a custom WebSocket audio relay server) is a significant engineering investment that is not the team's core competency.

### 7.3 TOP 3 Risks That Could Derail This Project

1. **LGPD non-compliance for audio data processing.** This is the single biggest risk because it is both legally serious and currently unaddressed. Streaming patient health data (audio) to US-based services without proper DPAs, consent documentation, and data flow mapping could result in regulatory action, fines, or forced shutdown. This must be resolved BEFORE writing code.

2. **Deployment architecture mismatch.** The custom WebSocket server cannot run on Vercel. This means either the deployment plan must change (Phase 9) or the audio transport architecture must change (Phase 3). Discovering this during Phase 9 would be a project-threatening late surprise.

3. **STT accuracy for Brazilian Portuguese medical terminology.** If the chosen STT service cannot reliably transcribe medical Portuguese -- especially with regional accents, colloquial terms, and medical jargon -- the entire system fails at its core mission. This is an empirical question that no amount of research can answer; it requires hands-on testing with real audio samples.

### 7.4 What Should Be Prototyped FIRST

Before committing to any architecture, build these minimal prototypes (in this order):

1. **STT Accuracy Test (1-2 days):** Record or collect 50 audio samples of Brazilian Portuguese medical conversations (or simulate them). Run them through Deepgram Nova-3, Google Cloud STT (with medical model), and OpenAI Whisper. Compare transcription accuracy, especially for medical terms and regional accents. This is the single most important validation. If no STT service achieves acceptable accuracy, the entire approach needs rethinking.

2. **Browser Audio Capture + WebSocket Streaming (2-3 days):** Build a minimal page that captures microphone audio via getUserMedia + AudioWorklet, streams PCM chunks over WebSocket to a Node.js server, and pipes them to Deepgram. Test on iOS Safari and Android Chrome. Verify echo cancellation with TTS playback. This validates the entire audio pipeline before building the UI.

3. **End-to-End Latency Measurement (1 day):** Measure actual latency from speech end to first audio response, using the composed pipeline (Deepgram STT -> GPT-4o-mini -> OpenAI TTS). If latency exceeds 2 seconds consistently, the UX may be unacceptable, and the team should consider Realtime API or LiveKit with tighter integration.

4. **Deployment Proof-of-Concept (1 day):** Deploy the WebSocket server to a cloud provider (Railway, Fly.io) and the Next.js app to Vercel. Verify they can communicate, handle CORS, and maintain WebSocket connections across networks. Verify this works on mobile devices. This validates the deployment architecture before investing in full development.

---

## Action Items

These must be resolved BEFORE moving to the planning phase for Phase 3.

1. **Resolve the sample rate conflict.** Make an explicit, documented decision: is the system 16kHz-only (composed pipeline) or does it need to support 24kHz (Realtime API compatibility)? If 16kHz-only, explicitly close the door on Realtime API for production.

2. **Conduct LGPD analysis for audio data.** Before writing code, document the complete data flow of patient audio: capture -> transport -> STT processing -> storage -> deletion. For each stage, identify the legal basis, data processor, geographic location, and retention period. Obtain or verify DPAs from Deepgram and OpenAI for health data processing.

3. **Resolve the deployment architecture conflict.** The roadmap says "deploy to Vercel" but the audio architecture requires a separate WebSocket server. Choose one: (a) change the deployment plan to include a VPS/container host for the WS server, or (b) adopt a managed WebRTC service (LiveKit Cloud, Daily.co) that eliminates the need for a custom WS server, or (c) use the `next-ws` package and accept the trade-offs. Document the decision and its implications.

4. **Fix the WebSocket authentication gap.** The code sample for the WebSocket server has zero authentication. Before planning, design how the WS server will verify the user's Supabase JWT on connection. This is a security requirement, not an enhancement.

5. **Run the STT accuracy prototype.** Collect Portuguese medical audio samples and benchmark Deepgram Nova-3, Google Cloud STT, and OpenAI Whisper. Measure WER for medical terms and regional accents. This data is needed to make an informed STT decision.

6. **Resolve the AEC / barge-in / playback contradiction.** Decide: does the system use `<audio>` element for TTS playback (better AEC) or `AudioContext.destination` (needed for gapless queue playback)? Does the system support barge-in from day one or not? Document the decision.

7. **Evaluate LiveKit as an alternative to custom WebSocket server.** Spend 1-2 hours reviewing LiveKit's documentation and agent framework. If it solves the transport, deployment, and visualization problems simultaneously, it may significantly reduce Phase 3 scope and risk.

8. **Define a testing strategy.** Before implementation, decide: how will the voice pipeline be tested? What tools will be used? What are the acceptance criteria for STT accuracy? How will browser compatibility be tested? The project has zero test infrastructure (per CLAUDE.md) -- this cannot continue into Phase 3.

9. **Establish cost monitoring from day one.** Set up usage tracking and cost alerts for all paid services (Deepgram, OpenAI). Define per-conversation and per-month cost caps. Plan what happens when caps are hit (degrade to free tier? block new sessions?).

10. **Clarify the emergency button behavior.** Research C designs an emergency button on the triage screen but never specifies what it does. For a medical application, this is a safety-critical design element. Define its behavior: does it call 192 (SAMU)? Display emergency instructions? Alert a human operator? This must be decided in planning, not left to implementation.

11. **Reconcile Research B's architecture diagrams with Research A's WebSocket findings.** Research B's pipeline diagrams show WebSocket handling inside Next.js API routes, which Research A says is not possible. Update the architecture to reflect reality.

12. **Address the 7-10 MB VAD model download for mobile users.** Plan for lazy loading, CDN caching, and a loading indicator. Consider whether the VAD model can be loaded from a first-party CDN (for LGPD compliance) rather than the default third-party CDN. Define acceptable load time on 3G connections.