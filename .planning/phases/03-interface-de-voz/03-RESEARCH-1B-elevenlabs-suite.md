# Research 1B-A: ElevenLabs Product Suite Deep Dive

**Researcher:** Agent A (ElevenLabs Focus)
**Date:** 2026-02-08
**Confidence:** Varies by section (noted inline)

---

## Executive Summary

ElevenLabs has evolved from a text-to-speech company into a **full-stack voice AI platform**. Their Agents Platform (formerly Conversational AI) is the most significant product for our Triagem Virtual project because it handles the entire voice conversation loop -- STT, LLM orchestration, TTS, VAD, and turn detection -- in a single managed service. This directly addresses the most critical pain point identified in the previous research review: **the need for a custom WebSocket server that conflicts with Vercel deployment**.

With ElevenLabs Agents, we do NOT need to build or host a custom WebSocket server. The client (browser) connects directly to ElevenLabs' infrastructure via WebRTC or WebSocket. ElevenLabs manages the STT, LLM routing, and TTS pipeline entirely. Our Next.js app on Vercel only needs to serve the frontend and handle authentication -- exactly what Vercel is designed for.

The platform supports pt-BR with high quality across all components (TTS ranked best-in-class, STT via Scribe v2 is competitive, multiple Brazilian Portuguese voices available). It supports custom tools/functions (enabling mid-conversation Supabase writes), configurable system prompts, post-call webhooks with data extraction, and visual workflow builders for multi-step conversation flows.

**Key trade-offs compared to the previously researched composed pipeline (Deepgram + GPT-4o-mini + OpenAI TTS):**

| Factor | ElevenLabs Agents | Previous Composed Pipeline |
|--------|-------------------|---------------------------|
| Infrastructure complexity | Much lower (no custom WS server) | High (custom WS server required) |
| Vercel compatibility | Full (client-side SDK only) | Broken (requires separate server) |
| Cost per 10-min conversation | ~$1.00-$1.50 (agent + LLM) | ~$0.14-$0.40 |
| Voice quality (pt-BR) | Excellent (industry-leading TTS) | Good to Very Good |
| Vendor lock-in | High (single vendor) | Low (swappable components) |
| Development time to MVP | Days-weeks | Weeks-months |
| LGPD/compliance posture | Strong (DPA available, zero-retention mode, EU residency) | Unverified (no DPAs confirmed) |
| HIPAA compliance | Available (Enterprise tier) | Not available |

**Recommendation:** ElevenLabs Agents should be seriously considered as the primary architecture for Phase 3, replacing the composed pipeline. The dramatic reduction in infrastructure complexity, native Vercel compatibility, and superior compliance posture outweigh the higher per-conversation cost, especially at MVP scale (10-100 conversations/day). The cost difference at MVP scale is roughly $30-$150/month vs $4-$40/month -- an acceptable premium for eliminating the deployment architecture problem entirely.

---

## 1. ElevenLabs Conversational AI (Agents Platform)

**Confidence: HIGH** -- based on official documentation (Feb 2026), changelog entries, and blog posts.

### 1.1 What It Is

ElevenLabs Agents Platform (rebranded from "Conversational AI") is a fully managed service for building real-time voice AI agents. It orchestrates the entire voice conversation pipeline:

```
User speaks -> [ElevenLabs Infrastructure] -> Agent responds with voice
                      |
         STT (Scribe) -> LLM (configurable) -> TTS (ElevenLabs models)
                      |
              VAD + Turn Detection + Interruption Handling
```

The developer configures an "agent" via the ElevenLabs dashboard or API, specifying:
- System prompt (personality, instructions, guardrails)
- First message (what the agent says when conversation starts)
- Voice (from library or cloned)
- LLM model (GPT, Claude, Gemini, or custom)
- Tools/functions (server tools, client tools, webhooks)
- Knowledge base (RAG-enabled document retrieval)
- Conversation flow settings (turn eagerness, timeouts, language)
- Post-call analysis (data extraction, webhooks)

### 1.2 Full Loop: Listen, Understand, Respond

Yes, ElevenLabs Agents handles the complete loop:

1. **Listen (STT):** Uses a fine-tuned ASR model internally (likely Scribe-based). Captures user speech, transcribes in real-time, and feeds text to the LLM. The internal STT supports 90+ languages including pt-BR.

2. **Understand (LLM):** Routes the transcribed text to the configured LLM (see supported models below). The LLM processes the system prompt + conversation history + user input and generates a text response. Tool/function calls are handled here.

3. **Respond (TTS):** Converts the LLM's text response to speech using ElevenLabs' own TTS models (Flash v2.5 for low latency, Turbo v2.5 for quality/latency balance). Streams audio back to the client.

The developer does NOT need to manage any of these individual connections. ElevenLabs handles the pipeline orchestration, audio streaming, buffering, and error recovery.

### 1.3 Built-In Components

| Component | Technology | Details |
|-----------|-----------|---------|
| **STT (ASR)** | Fine-tuned Scribe model | Proprietary, 90+ languages, optimized for real-time |
| **LLM** | Configurable (see 1.5) | Developer selects model; ElevenLabs routes to it |
| **TTS** | Flash v2.5 / Turbo v2.5 / v3 | ElevenLabs' own models; ~75ms latency (Flash) |
| **VAD** | Proprietary turn-taking model | Analyzes cues like "um", "ah", real-time analysis |
| **Turn Detection** | State-of-the-art turn-taking | Semantic understanding of when user finishes thought |
| **Interruption** | Built-in barge-in | User can interrupt agent mid-speech |
| **Language Detection** | Automatic | Detects language and responds in same language |
| **RAG** | Built-in knowledge base | Document upload, indexing, ~155ms median latency |

### 1.4 Conversational AI 2.0 Features (Dec 2025)

The 2.0 release added significant capabilities:

- **State-of-the-art turn-taking model**: Analyzes conversational cues in real-time (fillers like "um", "ah"), determining when to interrupt vs when to wait. This is critical for medical interviews where patients pause to think.
- **Automatic language detection and switching**: The agent detects the language being spoken and responds appropriately within the same interaction.
- **Multi-character mode**: Multiple AI characters in one conversation (not relevant for our use case).
- **Multimodality**: Can process images alongside audio (potential future use for showing symptoms).
- **Batch calls**: Outbound calling capability (not relevant).
- **Built-in RAG**: Integrated retrieval-augmented generation with 155ms median latency.
- **HIPAA compliance**: Available on Enterprise tier.
- **EU data residency**: Available for Enterprise customers.
- **Agent evaluation/testing**: Built-in tools to test guardrails, measure accuracy, verify tool calls.

### 1.5 Supported LLMs

ElevenLabs supports models from multiple providers:

**OpenAI:**
- GPT-4o, GPT-4o-mini
- GPT-5.1, GPT-5.1-2025-11-13 (added recently)

**Anthropic:**
- Claude Sonnet 4
- Claude Haiku (for latency-sensitive use)

**Google:**
- Gemini 2.5 models
- Gemini 3 Pro Preview (added recently)
- Gemini Flash series (low latency)

**ElevenLabs-hosted (cost-effective alternatives):**
- GLM 4.5 Air
- Qwen3-30b

**Custom LLM:**
- You can connect your own LLM via a server integration endpoint
- ElevenLabs sends the conversation context to your endpoint
- Your endpoint returns the LLM response
- System tools are exposed as function definitions

**Recommendation for our project:** Claude Sonnet 4 or GPT-4o-mini. Both handle Portuguese well. For tool calling during medical anamnesis, the documentation recommends "high intelligence models like GPT-4o mini or Claude 3.5 Sonnet" (Sonnet 4 is the successor). Avoid Gemini Flash for tool-heavy conversations.

### 1.6 Custom System Prompt

Yes, fully customizable. The system prompt is described as "the personality and policy blueprint of your AI agent." It defines:
- Agent's role and goals
- Allowable tools and when to use them
- Step-by-step instructions for tasks
- Guardrails (what the agent should NOT do)
- Tone and communication style

For our medical triage system, the system prompt would include:
- Medical anamnesis protocol (QP -> HDA -> antecedentes -> etc.)
- Empathetic, professional tone in Portuguese
- Guardrails: never diagnose, never prescribe, alert on emergency signs
- Tool calling instructions (when to save data to Supabase)
- Language: respond only in pt-BR

ElevenLabs provides a prompting guide with best practices for conversational agents.

### 1.7 Custom Tools and Functions

ElevenLabs supports three types of tools:

#### Server Tools (Webhooks)
- The agent calls an external API endpoint during the conversation
- You configure the URL, HTTP method, headers, and parameter schema
- The agent generates parameters dynamically based on the conversation
- **Use case for us:** Save patient data to Supabase mid-conversation
- Authentication via API keys, Bearer tokens, or custom headers
- The agent can use the API response in subsequent conversation

Example: When the patient states their chief complaint, the agent calls our Next.js API route `/api/triage/save-complaint` with the extracted text, which writes to Supabase.

#### Client Tools
- Functions that run in the user's browser
- Defined in the React SDK's `useConversation` hook via `clientTools`
- **Use case for us:** Update UI state, show visual feedback, trigger navigation
- The tool definition must match between the ElevenLabs dashboard and the client code

Example: When the agent detects an emergency, call a client tool that displays an emergency overlay with SAMU (192) contact information.

#### System Tools
- Built-in tools provided by ElevenLabs
- Examples: `skip_turn` (skip the agent's response), `end_call` (terminate conversation)
- Used when integrating custom LLMs

### 1.8 Connection Protocol: WebRTC and WebSocket

**WebRTC (Recommended for browser):**
- Ultra-low latency audio streaming
- Handles variable network conditions gracefully
- Built-in echo cancellation, noise suppression, automatic gain control
- The `@elevenlabs/react` SDK uses WebRTC by default
- **Critical advantage:** The browser connects directly to ElevenLabs' WebRTC infrastructure. No custom server needed. This means our Next.js app on Vercel only serves the frontend.

**WebSocket:**
- Alternative connection method
- Only the time where the model is generating audio counts toward concurrency limits
- Useful for server-to-server integrations

**For our project: WebRTC is the clear choice.** It eliminates the entire custom WebSocket server problem identified in the research review.

### 1.9 Conversation Configuration

Configured via the ElevenLabs dashboard or API:

- **System prompt**: Full text defining agent behavior
- **First message**: What the agent says when conversation starts (e.g., "Ola! Sou a assistente de triagem virtual. Como posso ajudar voce hoje?")
- **Voice**: Selected from voice library or custom clone
- **Language**: Set to Portuguese or automatic detection
- **Turn eagerness**: Controls how quickly the agent responds (lower = more patient, better for medical interviews)
- **Turn timeout**: How long to wait in silence before prompting (1-30 seconds)
- **Soft timeout**: Configurable prompts for when the user is silent too long
- **Spelling patience**: How long to wait when user spells something character by character (useful for medication names)

**Session overrides (dynamic, per-session):**
The SDK allows runtime overrides when starting a session:
```
overrides: {
  agent: {
    prompt: { prompt: "Custom prompt for this session" },
    firstMessage: "Personalized greeting",
    language: "pt-BR"
  },
  tts: {
    voiceId: "specific-voice-id"
  },
  conversation: {
    textOnly: false
  }
}
```

This allows us to personalize the agent per patient (e.g., include patient name, previous history).

### 1.10 Session Management

- **Duration limits**: No hard maximum session duration found in documentation. Conversations can have varying durations. The platform bills by the minute.
- **Turn-level timeouts**: Configurable 1-30 seconds of silence before agent prompts user.
- **Soft timeouts**: Configurable prompts and behavior when pauses occur at conversation level.
- **State persistence**: The conversation state (LLM context, transcript, tool results) is maintained server-side by ElevenLabs for the duration of the session.
- **Reconnection**: If the WebRTC connection drops, the SDK handles reconnection. Session state may or may not survive depending on the disconnection duration (needs testing).

### 1.11 Transcript Extraction

**During conversation:**
- The `onMessage` callback in the React SDK receives real-time events:
  - Tentative transcriptions of user speech (partial)
  - Final transcriptions of user speech
  - Agent text responses (LLM output)
  - Debug messages (if debug mode enabled)
- Real-time monitoring sessions stream conversation events including transcripts, agent responses, and corrections

**After conversation:**
- **GET `/v1/convai/conversations/{conversation_id}`** API endpoint returns full conversation details including:
  - Complete transcript (list of message objects)
  - Conversation metadata (duration, status)
  - Analysis results (if configured)
  - Extracted data (if data collection configured)

- **Post-call webhooks**: Automatically triggered after conversation ends. Three types:
  1. **Transcription webhook**: Full conversation data including transcripts, analysis results, and metadata
  2. **Audio webhook**: Base64-encoded audio of the full conversation
  3. **Call initiation failure webhook**: Information about failed calls

  Webhooks support HMAC signature authentication for security.

**Data Collection (Post-Call Analysis):**
- Configure in the Analysis tab of agent settings
- Define data extraction rules with descriptions
- Supports data types: String, Boolean, and others
- The LLM analyzes the transcript post-call and extracts structured data
- **Use case for us:** Extract chief complaint, symptom duration, severity, medications, allergies, etc. from the conversation transcript automatically

### 1.12 Turn Detection and Interruption

**Turn Eagerness:**
- Controls how quickly the agent interprets pauses as opportunities to respond
- Configurable in dashboard or via API
- Lower values = more patient (better for medical interviews where patients pause to think)
- Higher values = more responsive (better for quick Q&A)

**Speculative Turn (new):**
- Fine-tuning option for agent turn-taking behavior
- Allows the agent to speculatively prepare a response while the user might still be speaking

**Interruption (Barge-In):**
- Built-in support for user interrupting the agent mid-speech
- The agent stops speaking when the user starts talking
- Real-time monitoring includes barge-in control commands
- ElevenLabs' multi-context WebSocket handles interruptions by managing multiple audio streams concurrently

**For medical context:** The combination of low turn eagerness + the state-of-the-art turn-taking model (which understands fillers like "um", "ah") is well-suited for medical interviews. Patients often pause to recall symptoms or medications. The system should wait patiently.

### 1.13 ElevenLabs Agents vs OpenAI Realtime API

| Aspect | ElevenLabs Agents | OpenAI Realtime API |
|--------|-------------------|---------------------|
| **Architecture** | Modular (STT + LLM + TTS chained) | Unified speech-to-speech model |
| **LLM Flexibility** | GPT, Claude, Gemini, custom | GPT-realtime models only |
| **Voice Quality** | Industry-leading (ElevenLabs TTS) | Very good but less natural |
| **Function Calling Accuracy** | 80% (benchmark) | 66.5% (benchmark) |
| **Instruction Following** | >50% (benchmark) | 30.5% (benchmark) |
| **Reasoning** | >90% (benchmark) | 82% (benchmark) |
| **TTS Latency** | 75ms (Flash v2.5) | ~200ms |
| **Total Voice-to-Voice** | ~300-500ms estimated | ~250-300ms |
| **Custom Infrastructure** | None required | Custom WS/WebRTC server or ephemeral token API |
| **Pricing (10 min)** | ~$1.00-$1.50 | ~$0.65-$1.90 (gpt-realtime-mini to full) |
| **Session Duration** | No hard limit found | 60 minutes max |
| **Vendor Lock-in** | High (ElevenLabs + chosen LLM) | Very High (OpenAI only) |
| **HIPAA Compliance** | Yes (Enterprise) | Not available |
| **Data Residency** | EU option available | No |
| **Post-Call Analysis** | Built-in data extraction + webhooks | Manual implementation |
| **Knowledge Base (RAG)** | Built-in | Manual implementation |
| **Agent Workflows** | Visual workflow builder | Manual implementation |
| **Deployment on Vercel** | Yes (client SDK only) | Partial (needs token API route) |

**Key insight from ElevenLabs' own comparison:** ElevenLabs Agents showed advantages in function calling accuracy (80% vs 66.5%), instruction following (>50% vs 30.5%), and reasoning (>90% vs 82%) compared to OpenAI Realtime API. This is critical for our medical triage use case where the agent must reliably follow the anamnesis protocol and call tools to save data.

### 1.14 pt-BR Support Quality

- All TTS models support Portuguese (Brazilian) with native-quality pronunciation
- Flash v2.5 supports 32 languages including Portuguese with ultra-low latency
- Multiple Brazilian Portuguese voices available in the voice library
- Automatic language detection can identify pt-BR
- STT (Scribe) supports Portuguese with excellent accuracy (<=5% WER on FLEURS benchmark)
- Regional accents (Sao Paulo, Rio de Janeiro, Northeastern) are recognized

### 1.15 Pricing Model

ElevenLabs Agents are **billed by the minute**:

| Plan | Price per Minute | Minutes Included |
|------|-----------------|-----------------|
| Free | Included in credits | ~15-20 min/month |
| Creator ($22/mo) | ~$0.10/min (after included) | 250 min included |
| Pro ($99/mo) | ~$0.10/min (after included) | 1,100 min included |
| Scale ($330/mo) | ~$0.10/min (after included) | 3,600 min included |
| Business ($1,320/mo) | ~$0.08/min (annual) | 13,750 min included |
| Enterprise | Custom (lower) | Custom |

**LLM costs are additional:** When using non-ElevenLabs-hosted LLMs (GPT, Claude, Gemini), LLM token costs add approximately 10-30% on top of the per-minute agent cost. ElevenLabs is currently absorbing some LLM costs but this may change.

**Cost per 10-minute conversation:**
- Agent time: 10 min x $0.10/min = $1.00
- LLM overhead (~20%): ~$0.20
- **Total: ~$1.20 per conversation**

**Burst pricing:** You can enable burst pricing to temporarily exceed concurrency limits during high-demand periods, at 2x the standard rate per excess call.

### 1.16 Agent Workflows

A powerful feature for medical triage. Workflows provide a **visual interface for designing complex conversation flows**:

- **Subagent nodes**: Modify agent behavior at specific conversation phases (e.g., switch from "greeting" mode to "symptom collection" mode to "summary" mode)
- **Agent transfer nodes**: Hand off to a different agent configuration
- **Transfer to number nodes**: Transfer to a human operator via phone
- **LLM conditions**: Dynamic routing based on natural language evaluation (e.g., "if patient mentions chest pain, route to emergency protocol")
- **Deterministic routing**: Fixed routing logic for predictable paths

**Use case for our triage system:**
```
[Start: Greeting] -> [Collect Chief Complaint] -> [Detailed History]
                                                          |
                                              [Check for Emergency Signs]
                                                    /              \
                                        [Emergency Protocol]   [Continue Anamnesis]
                                                                      |
                                                          [Collect Past History]
                                                                      |
                                                          [Summary & Goodbye]
```

Each node can have its own system prompt modifications, tools, and behavior settings. This maps naturally to the medical anamnesis flow.

---

## 2. ElevenLabs Text-to-Speech

**Confidence: HIGH** -- based on official documentation, model pages, and third-party benchmarks.

### 2.1 Current Models

| Model | Latency | Quality | Languages | Best For |
|-------|---------|---------|-----------|----------|
| **Eleven v3** (GA Feb 2026) | Medium | Highest (4.14 MOS) | 70+ | Best expressiveness, audio tags, multi-speaker |
| **Flash v2.5** | ~75ms | High | 32 | Real-time agents (Agents Platform default) |
| **Turbo v2.5** | ~250-300ms | Very High | 32 | Balance of quality and speed |
| **Multilingual v2** | ~300ms+ | Very High (most emotional range) | 29 | High-quality narration, emotional content |
| **English v1** | Low | Good | 1 (English) | English-only legacy |

### 2.2 Eleven v3 (Latest)

Released in alpha in 2025, reached GA in February 2026. Key features:

- **Audio Tags**: Inline emotional and delivery control using bracketed cues:
  - `[sigh]`, `[excited]`, `[nervous]`, `[calm]`, `[empathetic]`
  - `[pauses]`, `[hesitates]`, `[whispers]`
  - `[cheerfully]`, `[flatly]`, `[warmly]`
  - **Medical relevance:** We could use `[warmly]`, `[calm]`, `[empathetic]` cues in the agent's responses for appropriate medical tone
- **Multi-speaker**: Natural conversations between multiple speakers in single audio
- **Contextual understanding**: Interprets emotional subtext of text automatically
- **68% fewer errors on technical notation**: Important for medical terms
- **70+ languages**: Expanded from 29 (Multilingual v2)

### 2.3 pt-BR Voice Quality

ElevenLabs is widely regarded as the best TTS for naturalness and expressiveness. For Portuguese Brazilian:

- Context awareness: 63.37% (vs OpenAI's 39.25%) -- means better understanding of Portuguese sentence context
- Prosody accuracy: 64.57% (vs OpenAI's 45.83%) -- more natural Portuguese intonation patterns
- Pronunciation accuracy: 82% (vs OpenAI's 77%) -- fewer mispronunciations

### 2.4 Available Brazilian Portuguese Voices

From the voice library (10,000+ community voices available):

| Voice Name | Description | Suitable For |
|-----------|-------------|-------------|
| **Carla** | Young adult, friendly Brazilian Portuguese female | Chat, conversational agent |
| **Joel** | Young, friendly male with countryside Brazilian accent | Conversational, laid-back |
| **Helena** | Light, lively Brazilian female with countryside accent | Kids, friendly content |
| **Marcio** | Middle-aged Brazilian male, rich engaging tone with warmth | Professional, narration |
| **Flavio Francisco** | Narrative Brazilian Portuguese male | Narration, formal |

For a medical triage agent, **Marcio** (warm, professional, middle-aged) or **Carla** (friendly, approachable female) would be strong candidates. The voice library likely contains additional Brazilian Portuguese voices not listed in search results.

### 2.5 Voice Cloning and Design

**Instant Voice Cloning:**
- Available from Starter plan ($5/mo)
- 1-2 minutes of clear audio required
- Quick turnaround, good quality
- Works across all supported languages including pt-BR
- **Use case:** Clone a specific Brazilian Portuguese medical professional's voice for authenticity

**Professional Voice Cloning (PVC):**
- Available from Creator plan ($22/mo)
- 2-3 hours of audio recommended for optimal results
- Hyper-realistic digital twin
- Works with Multilingual models (cross-language support)
- Higher quality but more effort to create
- **Use case:** Create the definitive "medical agent voice" for production

**Voice Design:**
- Create entirely new voices by specifying attributes
- Configurable: age, gender, accent, tone
- **Use case:** Design a specific "Brazilian medical professional" voice without needing source audio

### 2.6 Pronunciation for Medical Terms

- Eleven v3's 68% error reduction on technical notation suggests improved handling of medical terminology
- The model's contextual understanding helps with domain-specific pronunciation
- Audio tags can be used to control pacing around complex terms
- For Portuguese medical terms (dispneia, cefaleia, precordialgia), the model benefits from seeing them in context rather than isolation
- **No specific medical pronunciation mode** -- but the general model quality is high enough for most medical terms

### 2.7 Instruction Following (Tone Control)

With gpt-4o-mini-tts (OpenAI) you can instruct tone via text. With ElevenLabs v3, you use **audio tags**:

```
[warmly] Eu entendo que voce esta preocupado. [calmly] Vamos conversar
sobre os seus sintomas com calma. [pauses] Pode me contar quando comecou
a sentir essa dor?
```

This gives fine-grained control over the agent's delivery -- critical for creating an empathetic medical interaction.

### 2.8 TTS Pricing

TTS pricing is based on credits/characters within the plan:

| Plan | Credits/Month | ~Characters | Cost |
|------|--------------|-------------|------|
| Free | 10,000 | 10,000 | $0 |
| Starter | 30,000 | 30,000 | $5/mo |
| Creator | 100,000 | 100,000 | $22/mo |
| Pro | 500,000 | 500,000 | $99/mo |
| Scale | 2,000,000 | 2,000,000-4,000,000 | $330/mo |
| Business | 11,000,000 | 11,000,000-22,000,000 | $1,320/mo |

- Standard models: 1 credit per character
- Turbo/Flash models: 0.5 credits per character (2x more characters)
- Effective cost: ~$0.015-$0.030 per 1,000 characters

**Note:** When using Agents Platform, TTS is billed as part of the per-minute agent cost, NOT separately from the character quota. The character quota is for standalone TTS API usage.

---

## 3. ElevenLabs Speech-to-Text

**Confidence: HIGH** -- based on official documentation, TechCrunch coverage, and benchmark data.

### 3.1 Scribe v1 (Feb 2025)

ElevenLabs launched Scribe, their first standalone STT model, in February 2025:
- 99+ languages supported
- 96.7% accuracy for English (WER ~3.3%)
- Smart speaker diarization
- Word-level timestamps
- Auto-tagging of sound events (laughter, applause, etc.)
- Pricing: $0.40/hour of audio

### 3.2 Scribe v2 (Jan 2026)

Major upgrade:
- Industry-leading accuracy across 90+ languages
- Portuguese included in "excellent accuracy" category (<=5% WER)
- Multi-language detection within single audio files
- Improved handling of technical vocabulary including medications and proper nouns
- Built-in support for complex vocabulary

### 3.3 Scribe v2 Realtime (Nov 2025)

The real-time streaming variant:
- **Under 150ms latency** for live transcription
- 93.5% accuracy on FLEURS multilingual benchmark (lowest WER among low-latency ASR models)
- Outperforms: Google Gemini Flash 2.5 (90%), OpenAI GPT-4o Mini (85%), Deepgram Nova 3 (80%)
- Portuguese supported in the real-time variant
- 6 primary languages (English, French, German, Italian, Spanish, Portuguese) + 90+ others

### 3.4 Pricing

| Product | Price |
|---------|-------|
| Scribe v2 (batch) | $0.28/hour |
| Scribe v2 Realtime | Starts at $0.28/hour, volume discounts available |
| Within Agents Platform | Included in per-minute agent cost |

### 3.5 STT Within Agents Platform

When using ElevenLabs Agents, the internal STT (ASR) is a fine-tuned model -- likely based on Scribe technology but optimized for real-time conversational use. Key points:
- You do NOT separately configure or pay for STT when using Agents
- The STT is automatically applied to user audio input
- Transcripts are available via the `onMessage` callback and post-call API
- Portuguese is fully supported

### 3.6 Comparison with Deepgram Nova-3

| Aspect | ElevenLabs Scribe v2 RT | Deepgram Nova-3 |
|--------|------------------------|-----------------|
| Accuracy (FLEURS) | 93.5% | 80% |
| Portuguese WER | <=5% (excellent) | 7-16% (good, Tier 2) |
| Latency | <150ms | <300ms |
| Pricing (standalone) | $0.28/hr ($0.0047/min) | $0.0077/min |
| Medical vocabulary | "Built-in support for complex vocabulary" | Keyterm prompting |
| Speaker diarization | Yes | Yes |
| Within agent platform | Included | Requires custom integration |

**Key finding:** ElevenLabs Scribe v2 Realtime outperforms Deepgram Nova-3 on accuracy benchmarks, including for Portuguese. And when used within the Agents Platform, there is no additional cost -- it is included in the per-minute agent pricing.

---

## 4. ElevenLabs Voice Agent / Voice Cloning

**Confidence: HIGH**

### 4.1 Voice Design for Medical Agent

Voice Design allows creating entirely new voices by specifying attributes:
- **Age**: Middle-aged (most appropriate for medical professional)
- **Gender**: Male or Female (should test both with pt-BR users)
- **Accent**: Brazilian Portuguese
- **Tone**: Warm, professional, calm

This is a zero-cost way to create a custom voice without any source audio.

### 4.2 Voice Library

The ElevenLabs Voice Library contains:
- 10,000+ community-shared voices
- Voices can be filtered by language, accent, age, gender, use case
- Several Brazilian Portuguese voices already available (see Section 2.4)
- Voices can be previewed before selection
- Some voices are optimized for conversational AI (tagged accordingly)

### 4.3 Professional Voice Cloning

For a production medical triage system, Professional Voice Cloning offers the highest quality:
- **Requirement**: 2-3 hours of clean audio from a Portuguese-speaking voice actor or medical professional
- **Quality**: Hyper-realistic, indistinguishable from original speaker
- **Cross-language**: Once cloned, the voice works in all supported languages
- **Cost**: Included in Creator plan ($22/mo) and above
- **Process**: Upload audio samples, ElevenLabs trains the model, voice becomes available
- **LGPD note**: Voice cloning requires consent from the voice owner. For a hired voice actor, this is straightforward.

### 4.4 Instant Voice Cloning

Faster alternative for prototyping:
- **Requirement**: 1-2 minutes of clear audio
- **Quality**: Good but not as precise as Professional
- **Cost**: Included in Starter plan ($5/mo) and above
- **Use case**: Quick prototyping and testing different voice personalities

---

## 5. ElevenLabs SDK & Developer Tools

**Confidence: HIGH** -- based on npm packages, GitHub repos, and official docs.

### 5.1 Package Ecosystem

| Package | Purpose | npm |
|---------|---------|-----|
| `@elevenlabs/client` | Core TypeScript/JavaScript client | `@elevenlabs/client` |
| `@elevenlabs/react` | React hooks and components for web | `@elevenlabs/react` |
| `@elevenlabs/react-native` | React Native SDK | `@elevenlabs/react-native` |
| `@elevenlabs/convai-widget-core` | Core embeddable widget library | `@elevenlabs/convai-widget-core` |
| `@elevenlabs/convai-widget-embed` | Pre-bundled embeddable widget | `@elevenlabs/convai-widget-embed` |

### 5.2 React SDK (`@elevenlabs/react`)

The primary integration point for our Next.js app. Key API:

**`useConversation` Hook:**
```typescript
const conversation = useConversation({
  onConnect: ({ conversationId }) => { /* WebSocket connected */ },
  onDisconnect: () => { /* WebSocket disconnected */ },
  onMessage: (message) => { /* Transcript, agent response, debug */ },
  onError: (error) => { /* Error handling */ },
  onAudio: (audioData) => { /* Raw audio data received */ },
  clientTools: {
    saveToSupabase: async (params) => {
      // Called by the agent during conversation
      await supabase.from('consultations').upsert(params);
      return "Data saved successfully";
    },
    showEmergencyAlert: async () => {
      // Trigger emergency UI
      setShowEmergency(true);
      return "Emergency alert shown to user";
    }
  }
});

// Start conversation
const conversationId = await conversation.startSession({
  agentId: "your-agent-id",
  // OR signedUrl / conversationToken for private agents
  overrides: {
    agent: {
      prompt: { prompt: "Custom prompt..." },
      firstMessage: "Ola, [patient name]!",
      language: "pt-BR"
    },
    tts: {
      voiceId: "selected-voice-id"
    }
  }
});

// End conversation
await conversation.endSession();
```

**Key features:**
- WebRTC-based audio streaming (default, low latency)
- WebSocket fallback available
- Client tools for in-browser function execution
- Session overrides for dynamic personalization
- Event system for full lifecycle management
- `serverLocation` option: "us", "eu-residency", "in-residency", "global"

### 5.3 Embeddable Widget

For quick integration without custom UI:
- Web component standard (framework-agnostic)
- Works with React, Vue, vanilla JavaScript
- Customizable appearance
- Can be used for rapid prototyping before building custom UI
- **Not recommended for production** triage UI -- we need full control over the medical interface

### 5.4 Next.js Quick Start

ElevenLabs provides an official Next.js quickstart guide and a v0.dev Agents Platform template:
- Production-ready Next.js app with agent integration
- Demonstrates authentication, session management, and conversation handling
- Can be deployed directly to Vercel

There is also a dedicated Vercel + ElevenLabs integration documented at `vercel.com/docs/ai/elevenlabs`.

### 5.5 API Documentation Quality

- **Official docs**: Comprehensive at `elevenlabs.io/docs`
- **API reference**: Full OpenAPI spec with all endpoints documented
- **Cookbooks**: Step-by-step guides for common patterns (post-call webhooks, data collection, Next.js integration)
- **GitHub examples**: `github.com/elevenlabs/elevenlabs-examples` with working code
- **Changelog**: Detailed changelog with all API changes
- **Community**: Active community, help center, and support channels

### 5.6 Rate Limits and Concurrency

**Agents concurrency (concurrent active conversations):**

| Plan | Concurrency Limit |
|------|------------------|
| Free | 2 |
| Starter | 3 |
| Creator | 5 |
| Pro | 10 |
| Scale | 15 |
| Business | 15 |
| Enterprise | Custom (30+) |

**Burst pricing:** Temporarily exceed concurrency by up to 3x at 2x the normal rate.

**TTS API rate limits:**
- Free: 2 concurrent requests
- Starter: 3
- Creator: 5
- Pro: 10
- Scale: 15
- Business: 15

For our use case at MVP scale (10 conversations/day), the Creator plan's 5 concurrent connections is sufficient. Even at 100/day, the Pro plan's 10 concurrent connections should handle the load (assuming 10-minute conversations spread across business hours).

---

## 6. Pricing Deep Dive

**Confidence: HIGH** -- based on official pricing page, help articles, and third-party analyses.

### 6.1 Plan Overview

| Plan | Monthly Cost | Credits | TTS Minutes | Agent Minutes | Custom Voices | Key Features |
|------|-------------|---------|-------------|---------------|---------------|-------------|
| **Free** | $0 | 10,000 | ~10 min | ~15-20 min | 3 | Non-commercial, API access |
| **Starter** | $5 | 30,000 | ~30 min | Minimal | 10 | Commercial license, Instant Voice Cloning |
| **Creator** | $22 | 100,000 | ~100 min | 250 min | 30 | Professional Voice Cloning |
| **Pro** | $99 | 500,000 | ~500 min | 1,100 min | 100 | Higher concurrency, priority support |
| **Scale** | $330 | 2,000,000 | ~2,000 min | 3,600 min | 300 | Volume pricing |
| **Business** | $1,320 | 11,000,000 | ~11,000 min | 13,750 min | 500 | $0.08/min agents (annual) |
| **Enterprise** | Custom | Custom | Custom | Custom | Custom | HIPAA, EU residency, BAA, on-prem |

### 6.2 Conversational AI Pricing Specifically

After the February 2025 price cut (~50% reduction):

- **$0.10/minute** on Creator, Pro, Scale plans
- **$0.08/minute** on Business plan (annual billing)
- **Custom (lower)** on Enterprise plans
- **LLM costs additional**: 10-30% overhead for non-ElevenLabs LLMs

Included minutes per plan:
- Creator: 250 min/month (~25 ten-minute conversations)
- Pro: 1,100 min/month (~110 conversations)
- Scale: 3,600 min/month (~360 conversations)
- Business: 13,750 min/month (~1,375 conversations)

### 6.3 Cost Projections for Our System

Assuming 10-minute average triage conversation, $0.10/min agent + ~20% LLM overhead = ~$1.20/conversation:

| Volume | Conversations/Month | Agent Cost | Best Plan | Plan Cost | Total/Month | Per Conv |
|--------|-------------------|------------|-----------|-----------|-------------|----------|
| **Dev/Test** | 5-10/day (150-300) | $180-$360 | Pro ($99) | $99 + overage | $99-$360 | $0.33-$1.20 |
| **Small** | 10/day (300) | $360 | Pro ($99) | $99 + $160 overage | ~$259 | ~$0.86 |
| **Medium** | 50/day (1,500) | $1,800 | Scale ($330) | $330 + $1,140 overage | ~$1,470 | ~$0.98 |
| **Large** | 100/day (3,000) | $3,600 | Scale ($330) | $330 + $2,700 overage | ~$3,030 | ~$1.01 |
| **High** | 300/day (9,000) | $10,800 | Business ($1,320) | $1,320 + $7,480 overage | ~$8,800 | ~$0.98 |

**Note on included minutes:** The Pro plan includes 1,100 agent minutes. At 10 min/conversation, that covers ~110 conversations. For 300 conversations/month, overage of ~190 conversations x 10 min x $0.10 = $190. Plus the $99 base = ~$289/month.

### 6.4 Comparison with Previous Architecture Cost

| Volume | ElevenLabs Agents | Composed Pipeline (Deepgram+GPT+OpenAI TTS) | Difference |
|--------|-------------------|----------------------------------------------|------------|
| 10/day (300/mo) | ~$259/mo | ~$43/mo | 6x more |
| 100/day (3,000/mo) | ~$3,030/mo | ~$432/mo | 7x more |
| 1,000/day (30,000/mo) | ~$30,000/mo | ~$4,320/mo | 7x more |

**However**, the composed pipeline cost does NOT include:
- VPS hosting for WebSocket server: $20-$100/month
- DevOps time to maintain separate infrastructure
- Development time to build, test, and debug custom pipeline (weeks-months)
- Potential Supabase Pro plan for production: $25/month
- Monitoring/logging tools: $20-$50/month

When factoring in infrastructure and development costs, the real comparison at small scale is:
- ElevenLabs: ~$259/month, 1-2 weeks to integrate
- Composed: ~$43 + $65-$175 infrastructure + 4-8 weeks development time = higher TCO at MVP stage

### 6.5 Free Tier for Development

The Free plan provides:
- ~15-20 minutes of Conversational AI
- 10,000 characters of TTS
- 3 custom voices
- API access
- **Sufficient for building and testing the initial integration**

The Starter plan ($5/month) adds commercial license and instant voice cloning. For active development, the Creator plan ($22/month) with 250 agent minutes provides adequate testing capacity.

### 6.6 Hidden Costs

1. **LLM costs**: Not fully included. Using GPT-4o or Claude Sonnet adds 10-30% to agent costs. ElevenLabs-hosted LLMs (GLM 4.5 Air, Qwen3-30b) may avoid this.
2. **Burst pricing**: If you exceed concurrency limits, excess calls cost 2x normal rate.
3. **Premium features**: HIPAA, EU residency, BAA require Enterprise tier (custom pricing).
4. **Overage**: Going beyond included minutes is billed at per-minute rates.
5. **Voice cloning**: Professional Voice Cloning requires Creator plan ($22/mo) minimum.

---

## 7. ElevenLabs vs Previous Architecture: Full Comparison

**Confidence: HIGH**

| Aspect | Previous (Deepgram + GPT-4o-mini + OpenAI TTS) | ElevenLabs Conversational AI (Agents) |
|--------|----------------------------------------------|--------------------------------------|
| **Architecture Complexity** | HIGH -- Custom WebSocket server, 3 separate service integrations, audio pipeline management, session state handling | LOW -- Client SDK connects directly to ElevenLabs; no custom server |
| **Deployment** | BROKEN on Vercel -- requires separate VPS for WebSocket server, dual deployment pipeline, CORS management | WORKS on Vercel -- client-only integration, Next.js serves frontend only |
| **Development Time to MVP** | 4-8 weeks (audio pipeline + WS server + STT integration + LLM integration + TTS integration + VAD + turn detection) | 1-2 weeks (configure agent + integrate React SDK + build UI) |
| **Cost per Conversation (10 min)** | ~$0.14-$0.40 | ~$1.00-$1.50 |
| **Cost at 300 conv/month** | ~$43-$120 + $65-$175 infra | ~$259 |
| **Cost at 3,000 conv/month** | ~$432-$1,200 + $65-$175 infra | ~$3,030 |
| **Voice Quality (pt-BR)** | Good to Very Good (OpenAI TTS) | Excellent (ElevenLabs industry-leading) |
| **STT Accuracy (Portuguese)** | Good (Deepgram Nova-3, 7-16% WER) | Better (Scribe v2 internal, <=5% WER) |
| **Latency (voice-to-voice)** | 700-1,450ms (basic), 500-700ms (optimized) | ~300-500ms (Flash v2.5 TTS) |
| **Turn Detection** | Must build custom (client-side VAD with @ricky0123/vad-web) | Built-in state-of-the-art turn-taking model |
| **Barge-In/Interruption** | Must build custom (echo cancellation challenges) | Built-in with multi-context audio handling |
| **Vendor Lock-In** | LOW -- can swap STT, LLM, or TTS independently | HIGH -- all components through ElevenLabs |
| **LGPD Compliance** | UNVERIFIED -- no DPAs confirmed for Deepgram or OpenAI | STRONG -- DPA available, zero-retention mode, EU residency option |
| **HIPAA Compliance** | NOT available | Available (Enterprise tier) |
| **Post-Call Data Extraction** | Must build custom | Built-in (configurable data collection + webhooks) |
| **Knowledge Base (RAG)** | Must build custom | Built-in with 155ms median latency |
| **Conversation Workflows** | Must build custom | Visual workflow builder |
| **Concurrent Users** | Limited by custom WS server capacity | Managed by ElevenLabs (plan-based limits) |
| **Scalability** | Must manage scaling of custom WS server | Auto-scaled by ElevenLabs |
| **Reliability** | Depends on custom infrastructure + 3 services | Single SLA from ElevenLabs |
| **Testing** | Must build custom audio testing pipeline | Built-in agent evaluation tools |
| **Mobile Support** | Must test and fix browser audio quirks | Handled by SDK (WebRTC standard) |
| **Echo Cancellation** | Complex (AEC issues documented in Research Review) | Handled by WebRTC standard implementation |

---

## 8. What ElevenLabs Does NOT Cover

**Confidence: HIGH**

### 8.1 We MUST Still Build

1. **Frontend UI (Triage Screen)**
   - Custom triage interface with medical-appropriate design
   - Transcript display (real-time, using `onMessage` callback)
   - State indicators (listening / processing / speaking)
   - Emergency button with SAMU (192) integration
   - Visual feedback (animated orb or similar)
   - The ElevenLabs widget exists but is too generic for a medical app

2. **Supabase Integration**
   - Server tools (webhooks) to save data during conversation
   - Post-call webhook receiver to store final transcript and analysis
   - Database schema for consultations (already designed)
   - RLS policies (already in progress, Phase 2)

3. **Authentication & Consent Flow**
   - Patient login/signup (already built, Phase 1)
   - LGPD consent screen before triage (Phase 2)
   - Session token generation for private agent access
   - Signed URL generation for secure agent sessions

4. **Medical System Prompt Design**
   - Detailed anamnesis protocol in Portuguese
   - Guardrails (no diagnosis, no prescription, emergency alerts)
   - Tone guidelines (empathetic, professional, patient)
   - Tool calling instructions
   - This is a content/medical design task, not engineering

5. **Post-Conversation Summary Generation**
   - ElevenLabs provides raw transcript and data extraction
   - We still need to generate a structured clinical summary
   - Options:
     a. Use ElevenLabs' data collection to extract structured fields during post-call analysis
     b. Take the transcript and run it through our own LLM call for structured summary
     c. Combination: extract key data via ElevenLabs, generate narrative summary via separate LLM call
   - Urgency classification (emergency/urgency/low urgency/non-urgent) can be part of data collection config

6. **Doctor Dashboard**
   - Patient queue ordered by urgency (Phase 6)
   - Clinical summary display
   - Transcript viewer
   - Status management (pending -> reviewing -> contacted -> completed)
   - Entirely our frontend + Supabase work

7. **Contact/Notification System**
   - Doctor-to-patient contact initiation (Phase 7)
   - Email or in-app notifications
   - Not related to voice infrastructure

### 8.2 We Can LEVERAGE from ElevenLabs

1. **Data Extraction**: Configure post-call analysis to extract: chief complaint, symptom duration, severity, medications, allergies, family history, urgency indicators. This reduces the custom LLM summarization work.

2. **Post-Call Webhooks**: Automatically receive full conversation data (transcript + extracted data + audio) at our API endpoint after each conversation. We save this directly to Supabase.

3. **Agent Workflows**: Use the visual workflow builder to structure the anamnesis flow, reducing the complexity of the system prompt and making the conversation flow more predictable.

4. **Knowledge Base**: Upload medical reference documents (emergency protocols, symptom checklists) to the agent's knowledge base for RAG-powered responses.

### 8.3 Integration Architecture

```
                    Vercel (Next.js)                    ElevenLabs
                    ===============                    ===========

[Patient Browser]
      |
      |- HTTP --> [Next.js Pages/API Routes]
      |              |
      |              |- /api/agent/session (POST)
      |              |    Generate signed URL for
      |              |    private agent session
      |              |    (validates Supabase auth)
      |              |
      |              |- /api/webhooks/post-call (POST) <-- [Post-Call Webhook]
      |              |    Receive transcript + analysis      from ElevenLabs
      |              |    Save to Supabase
      |              |
      |              |- /api/triage/save (POST) <--------- [Server Tool Call]
      |                   Called by agent mid-conversation   from ElevenLabs
      |                   Save partial data to Supabase
      |
      |- WebRTC --> [ElevenLabs Agents Infrastructure]
           Direct browser-to-ElevenLabs connection
           No custom server needed
           Audio streaming, STT, LLM, TTS all managed
```

**This architecture is fully compatible with Vercel deployment.** The Next.js app only handles:
- Static page serving
- API routes for authentication and data persistence
- Webhook endpoints (standard HTTP POST)

No long-running WebSocket connections. No custom audio processing server. No dual deployment.

---

## Recommendations

### Primary Recommendation: Adopt ElevenLabs Agents Platform

**Rationale:**

1. **Eliminates the deployment architecture conflict.** The research review identified the custom WebSocket server vs Vercel conflict as a top-3 project-derailing risk. ElevenLabs Agents completely eliminates this problem. The client connects directly to ElevenLabs via WebRTC; our Next.js app on Vercel only serves frontend and handles API routes.

2. **Dramatically reduces development scope.** Phase 3 (Voice Interface) and Phase 4 (Conversational Agent) can be partially merged. Instead of building: audio capture pipeline + AudioWorklet + WebSocket server + VAD integration + STT integration + LLM orchestration + TTS integration + turn detection + interruption handling + echo cancellation -- we configure an agent on ElevenLabs and integrate the React SDK.

3. **Superior compliance posture.** ElevenLabs provides a DPA covering LGPD, offers zero-retention mode, EU data residency, and HIPAA compliance. The previous architecture had ZERO confirmed DPAs from Deepgram or OpenAI -- identified as the #1 risk in the research review.

4. **Better voice quality for pt-BR.** ElevenLabs is the acknowledged leader in TTS naturalness. For a medical application where empathy and trust matter, this is significant.

5. **Built-in features we would otherwise build.** Data extraction, post-call webhooks, knowledge base (RAG), agent workflows, turn detection, barge-in handling -- all included.

### Cost Mitigation Strategy

The higher per-conversation cost (~$1.00-$1.50 vs ~$0.14-$0.40) is the main downside. Mitigation:

1. **Start with Pro plan ($99/mo)** -- includes 1,100 agent minutes. Sufficient for ~110 ten-minute conversations/month during MVP/beta.
2. **Optimize conversation length.** A well-designed anamnesis workflow should target 7-8 minutes average, not 10-15. Shorter conversations = lower cost.
3. **Use ElevenLabs-hosted LLMs** (GLM 4.5 Air, Qwen3-30b) to avoid LLM overhead charges during development. Switch to GPT/Claude for production if quality requires it.
4. **Monitor and optimize.** Track actual conversation durations, identify where the agent spends unnecessary time, and refine the system prompt.
5. **Scale to Business plan** ($1,320/mo, $0.08/min) if volume exceeds 300 conversations/month consistently.
6. **Negotiate Enterprise pricing** if the project proves viable at scale.

### Fallback Plan

If ElevenLabs Agents proves inadequate (cost, quality, reliability), we have a clear fallback:

1. **Use ElevenLabs TTS only** (standalone API) + Deepgram STT + custom LLM orchestration. This preserves the voice quality advantage while reducing per-minute costs.
2. **Adopt LiveKit** (identified in the research review as a strong alternative) for the audio transport layer, avoiding the custom WebSocket server problem.
3. The React SDK integration patterns would partially transfer since we would still use ElevenLabs for TTS.

### Implementation Priority

1. **Week 1:** Create ElevenLabs account, configure a basic pt-BR agent, test with the embeddable widget
2. **Week 1:** Design the medical system prompt and configure agent with first message, voice, and basic tools
3. **Week 2:** Integrate `@elevenlabs/react` SDK into the Next.js triage page with custom UI
4. **Week 2:** Implement server tools for Supabase data persistence (mid-conversation saves)
5. **Week 3:** Configure post-call webhooks and data extraction for consultation records
6. **Week 3:** Build triage UI (transcript display, state indicators, emergency button)
7. **Week 4:** Test with pt-BR speakers, refine turn detection settings, optimize system prompt

---

## Open Questions

1. **Exact STT model used internally in Agents Platform.** Is it Scribe v2 Realtime or a different fine-tuned model? This affects our understanding of Portuguese medical term accuracy within conversations.

2. **Maximum session duration.** No hard limit found in documentation, but this needs explicit confirmation for conversations that might last 20-30 minutes (complex medical histories).

3. **Reconnection behavior.** If WebRTC drops mid-conversation, does the session state survive? Can the patient reconnect and continue? What is the grace period?

4. **Data residency for non-Enterprise plans.** EU residency is confirmed for Enterprise. Where is data processed on Creator/Pro/Scale plans? Is the default US-based? Does this create LGPD issues?

5. **LLM cost transparency.** The "10-30% LLM overhead" is vague. Can we see exact LLM token costs per conversation? Are there dashboards for this?

6. **Agent evaluation for Portuguese.** The built-in testing/evaluation tools -- do they work well for Portuguese conversations? Can we run automated tests with Portuguese audio samples?

7. **Voice cloning consent under LGPD.** If we clone a Brazilian voice actor's voice, what documentation do we need for LGPD compliance? Does ElevenLabs provide guidance?

8. **Scribe v2 accuracy for Portuguese medical terms.** The <=5% WER is for general Portuguese. What about medical terminology specifically? Need to test with medical conversation samples.

9. **Client tools reliability.** How reliable is the client tool execution? If the browser loses focus or the device sleeps, do client tools still execute? Should we prefer server tools for critical operations?

10. **Audio recording availability.** Can we receive the full conversation audio recording for compliance purposes (CFM 20-year retention requirement)? The audio webhook provides this -- but is it available on all plans?

---

## Sources

### ElevenLabs Official Documentation
- [Agents Platform Overview](https://elevenlabs.io/docs/agents-platform/overview)
- [Conversational AI Overview](https://elevenlabs.io/docs/conversational-ai/overview)
- [React SDK](https://elevenlabs.io/docs/agents-platform/libraries/react)
- [JavaScript SDK](https://elevenlabs.io/docs/agents-platform/libraries/java-script)
- [Server Tools](https://elevenlabs.io/docs/agents-platform/customization/tools/server-tools)
- [Client Tools](https://elevenlabs.io/docs/agents-platform/customization/tools/client-tools)
- [System Tools](https://elevenlabs.io/docs/agents-platform/customization/tools/system-tools)
- [Conversation Flow](https://elevenlabs.io/docs/agents-platform/customization/conversation-flow)
- [Agent Workflows](https://elevenlabs.io/docs/agents-platform/customization/agent-workflows)
- [LLM Models](https://elevenlabs.io/docs/agents-platform/customization/llm)
- [Custom LLM Integration](https://elevenlabs.io/docs/agents-platform/customization/llm/custom-llm)
- [Prompting Guide](https://elevenlabs.io/docs/agents-platform/best-practices/prompting-guide)
- [Post-Call Webhooks](https://elevenlabs.io/docs/agents-platform/workflows/post-call-webhooks)
- [Data Collection](https://elevenlabs.io/docs/agents-platform/customization/agent-analysis/data-collection)
- [Conversation Analysis](https://elevenlabs.io/docs/agents-platform/customization/agent-analysis)
- [Overrides](https://elevenlabs.io/docs/agents-platform/customization/personalization/overrides)
- [Privacy](https://elevenlabs.io/docs/agents-platform/customization/privacy)
- [Real-Time Monitoring](https://elevenlabs.io/docs/agents-platform/guides/realtime-monitoring)
- [Get Conversation Details API](https://elevenlabs.io/docs/api-reference/conversations/get)
- [HIPAA Compliance](https://elevenlabs.io/docs/agents-platform/legal/hipaa)
- [Data Residency](https://elevenlabs.io/docs/overview/administration/data-residency)
- [Models Overview](https://elevenlabs.io/docs/overview/models)
- [TTS Overview](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)
- [STT Overview](https://elevenlabs.io/docs/overview/capabilities/speech-to-text)
- [Voices Overview](https://elevenlabs.io/docs/overview/capabilities/voices)
- [Widget Customization](https://elevenlabs.io/docs/conversational-ai/customization/widget)
- [Next.js Quickstart](https://elevenlabs.io/docs/agents-platform/guides/quickstarts/next-js)
- [WebSocket API](https://elevenlabs.io/docs/agents-platform/libraries/web-sockets)
- [Changelog](https://elevenlabs.io/docs/changelog)
- [Professional Voice Cloning](https://elevenlabs.io/docs/creative-platform/voices/voice-cloning/professional-voice-cloning)
- [Instant Voice Cloning](https://elevenlabs.io/docs/creative-platform/voices/voice-cloning/instant-voice-cloning)

### ElevenLabs Official Blog
- [Conversational AI 2.0](https://elevenlabs.io/blog/conversational-ai-2-0)
- [We Cut Our Pricing for Conversational AI](https://elevenlabs.io/blog/we-cut-our-pricing-for-conversational-ai)
- [Eleven v3 Launch](https://elevenlabs.io/blog/eleven-v3)
- [Introducing Scribe v2 Realtime](https://elevenlabs.io/blog/introducing-scribe-v2-realtime)
- [Introducing Scribe v2](https://elevenlabs.io/blog/introducing-scribe-v2)
- [ElevenLabs Agents vs OpenAI Realtime API](https://elevenlabs.io/blog/elevenlabs-agents-vs-openai-realtime-api-conversational-agents-showdown)
- [Comparing ElevenLabs Conversational AI vs OpenAI Realtime API](https://elevenlabs.io/blog/comparing-elevenlabs-conversational-ai-v-openai-realtime-api)
- [Conversational AI WebRTC Support](https://elevenlabs.io/blog/conversational-ai-webrtc)
- [ElevenLabs-Hosted LLMs](https://elevenlabs.io/blog/elevenlabs-hosted-llms)
- [How to Prompt a Conversational AI System](https://elevenlabs.io/blog/how-to-prompt-a-conversational-ai-system)
- [Engineering RAG to be 50% Faster](https://elevenlabs.io/blog/engineering-rag)
- [Introducing Agent Workflows](https://elevenlabs.io/blog/introducing-agent-workflows)
- [Audio Tags - Emotional Context in Speech](https://elevenlabs.io/blog/eleven-v3-audio-tags-expressing-emotional-context-in-speech)
- [Audio Tags - Situational Awareness](https://elevenlabs.io/blog/eleven-v3-situational-awareness)
- [Audio Tags - Precision Delivery Control](https://elevenlabs.io/blog/eleven-v3-audio-tags-precision-delivery-control-for-ai-speech)
- [Meet Flash](https://elevenlabs.io/blog/meet-flash)
- [Meet Scribe](https://elevenlabs.io/blog/meet-scribe)
- [Voice Agents and Conversational AI Trends](https://elevenlabs.io/blog/voice-agents-and-conversational-ai-new-developer-trends-2025)
- [Introducing European Data Residency](https://elevenlabs.io/blog/introducing-european-data-residency)

### ElevenLabs Official Pages
- [API Pricing](https://elevenlabs.io/pricing/api)
- [Conversational AI Platform](https://elevenlabs.io/conversational-ai)
- [Speech to Text](https://elevenlabs.io/speech-to-text)
- [Realtime Speech to Text](https://elevenlabs.io/realtime-speech-to-text)
- [Portuguese TTS Voices](https://elevenlabs.io/text-to-speech/portuguese)
- [Portuguese Accent TTS](https://elevenlabs.io/text-to-speech/portuguese-accent)
- [Voice Cloning](https://elevenlabs.io/voice-cloning)
- [Enterprise](https://elevenlabs.io/enterprise)
- [Data Processing Addendum (DPA)](https://elevenlabs.io/dpa)
- [Trust Center](https://compliance.elevenlabs.io/)
- [HIPAA Healthcare Answering Service](https://elevenlabs.io/agents/hipaa-compliant-answering-service)
- [Healthcare AI Agents](https://elevenlabs.io/agents/conversational-ai-healthcare)
- [AI Agent Builder](https://elevenlabs.io/agents/ai-agent-builder)

### ElevenLabs Help Center
- [How Much Does ElevenLabs Agents Cost?](https://help.elevenlabs.io/hc/en-us/articles/29298065878929-How-much-does-ElevenLabs-Agents-formerly-Conversational-AI-cost)
- [Agents Concurrency Limits](https://help.elevenlabs.io/hc/en-us/articles/31601651829393-How-many-ElevenLabs-Agents-formerly-Conversational-AI-requests-can-I-make-and-can-I-increase-it)
- [What Can I Create with Agents?](https://help.elevenlabs.io/hc/en-us/articles/29297893189137-What-can-I-create-with-ElevenLabs-Agents-formerly-Conversational-AI)
- [How to Use Tools with Agents](https://help.elevenlabs.io/hc/en-us/articles/34669011018257-How-to-use-tools-with-ElevenLabs-Agents-formerly-Conversational-AI)
- [Supported Languages](https://help.elevenlabs.io/hc/en-us/articles/13313366263441-What-languages-do-you-support)
- [PVC Language Support](https://help.elevenlabs.io/hc/en-us/articles/19569659818129-What-languages-are-supported-with-Professional-Voice-Cloning-PVC)
- [How to Produce Emotions](https://help.elevenlabs.io/hc/en-us/articles/14187482972689-How-to-produce-emotions)
- [API Rate Limits](https://help.elevenlabs.io/hc/en-us/articles/14312733311761-How-many-requests-can-I-make-and-can-I-increase-it)

### GitHub & npm
- [ElevenLabs Packages (GitHub)](https://github.com/elevenlabs/packages)
- [ElevenLabs Examples (GitHub)](https://github.com/elevenlabs/elevenlabs-examples)
- [@elevenlabs/react (npm)](https://www.npmjs.com/package/@elevenlabs/react)
- [@elevenlabs/client (npm)](https://www.npmjs.com/package/@elevenlabs/client)
- [@11labs/react (npm, legacy)](https://www.npmjs.com/package/@11labs/react)

### Third-Party Analysis & Comparisons
- [ElevenLabs Pricing Complete Guide (FlexPrice)](https://flexprice.io/blog/elevenlabs-pricing-breakdown)
- [ElevenLabs Pricing Breakdown (eesel.ai)](https://www.eesel.ai/blog/elevenlabs-pricing)
- [ElevenLabs Pricing Explained (fish.audio)](https://fish.audio/vs/pricing/elevenlabs/)
- [ElevenLabs Pricing Plans (WebsiteVoice)](https://websitevoice.com/blog/elevenlabs-pricing-plans/)
- [ElevenLabs Pricing (SaaSworthy)](https://www.saasworthy.com/product/elevenlabs-io/pricing)
- [ElevenLabs Pricing (Orb)](https://www.withorb.com/blog/eleven-labs-pricing)
- [ElevenLabs Pricing (AffMaven)](https://affmaven.com/elevenlabs-pricing/)
- [ElevenLabs vs OpenAI TTS (Vapi)](https://vapi.ai/blog/elevenlabs-vs-openai)
- [AI Voices Compared 2026 (Magic Hour)](https://magichour.ai/blog/ai-voices-compared)
- [Deepgram vs ElevenLabs (Deepgram)](https://deepgram.com/learn/deepgram-vs-elevenlabs)
- [ElevenLabs vs Azure AI Speech (Aloa)](https://aloa.co/ai/comparisons/ai-voice-comparison/elevenlabs-vs-azure-speech/)
- [STT/TTS Comparison for Voice Agents (Softcery)](https://softcery.com/lab/how-to-choose-stt-tts-for-ai-voice-agents-in-2025-a-comprehensive-guide)
- [OpenAI Realtime API vs ElevenLabs Voice Quality (Skywork)](https://skywork.ai/blog/agent/openai-realtime-api-vs-elevenlabs-voice-quality-test/)
- [ElevenLabs STT Launch (TechCrunch)](https://techcrunch.com/2025/02/26/elevenlabs-is-launching-its-own-speech-to-text-model/)
- [ElevenLabs Scribe Accuracy (VentureBeat)](https://venturebeat.com/ai/elevenlabs-new-speech-to-text-model-scribe-is-here-with-highest-accuracy-rate-so-far-96-7-for-english)
- [ElevenLabs Scribe v2 Realtime (Quasa)](https://quasa.io/media/elevenlabs-launches-scribe-v2-realtime-a-breakthrough-in-ultra-low-latency-speech-to-text)
- [ElevenLabs Portuguese Voices (json2video)](https://json2video.com/ai-voices/elevenlabs/languages/portuguese/)
- [Vercel + ElevenLabs Integration](https://vercel.com/docs/ai/elevenlabs)
- [ElevenLabs Next.js Playground](https://elevenlabs-nextjs.vercel.app/)

### Vercel & Integration
- [Vercel ElevenLabs Integration Docs](https://vercel.com/docs/ai/elevenlabs)
- [Data Collection with Agents Platform in Next.js (ElevenLabs Cookbook)](https://elevenlabs.io/docs/cookbooks/agents-platform/post-call-webhooks)
- [Vercel AI SDK + ElevenLabs (Cookbook)](https://elevenlabs.io/docs/cookbooks/speech-to-text/vercel-ai-sdk)
