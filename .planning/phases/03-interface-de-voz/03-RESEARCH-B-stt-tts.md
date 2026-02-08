# Research B: STT & TTS Services
**Researcher:** Agent B
**Date:** 2026-02-08
**Confidence:** HIGH (pricing verified against official sources Jan-Feb 2026; pt-BR quality assessments based on documentation + community reports)

---

## Executive Summary

For the Triagem Virtual voice triage system, the choice of Speech-to-Text (STT) and Text-to-Speech (TTS) services fundamentally shapes the patient experience, cost structure, and technical architecture. After evaluating seven STT services and six TTS services, the **primary recommendation is a composed pipeline using Deepgram Nova-3 (STT) + OpenAI gpt-4o-mini-tts (TTS)**, with the **OpenAI Realtime API (gpt-realtime-mini) as a strong secondary option** that merits prototyping.

The composed pipeline offers the best balance of pt-BR quality, latency (~500-700ms end-to-end), cost efficiency (~$0.09/min total), and architectural flexibility -- critically important for a medical application where STT accuracy for Portuguese medical terminology directly impacts patient safety. The OpenAI Realtime API provides a simpler architecture with lower latency (~250-300ms) but at 3-4x higher cost and with less control over individual components, a 60-minute session limit that matters for complex medical histories, and less proven pt-BR medical vocabulary handling.

ElevenLabs remains the gold standard for TTS voice quality and naturalness in pt-BR, but its higher cost and credit-based pricing make it better suited as a premium upgrade after MVP validation. The Web Speech API should be implemented as a free fallback for development and for users whose conversations are simple, but its medical vocabulary limitations and browser dependency make it unsuitable as the primary production service.

---

## 1. STT Service Comparison

### 1.1 Deepgram (Nova-2 / Nova-3)

**Overview:** Deepgram is a purpose-built speech AI company offering Nova-2 and Nova-3 models. Nova-3, released in 2025, represents their latest advancement with significant multilingual improvements.

**pt-BR Support:**
- Nova-3 supports Portuguese in Tier 2 (7-16% WER), which is considered good accuracy
- Supports real-time code-switching across 10 languages including Portuguese
- Monolingual Portuguese STT correctly transcribes "um" (meaning "one") as a non-filler word -- important for Portuguese accuracy
- Keyterm prompting available for medical vocabulary boosting

**Streaming:** Full WebSocket-based streaming with sub-300ms latency. Captures audio at 16kHz and processes in real-time chunks.

**Pricing (Pay-As-You-Go, Feb 2026):**
- Streaming: $0.0077/min
- Pre-recorded/batch: $0.0043/min (English), $0.0052/min (multilingual)
- Growth plan: $0.0065/min (requires $4,000/year commitment)
- $200 free credits for new accounts
- Billed per exact second (no rounding)

**Medical Terms:** Keyterm prompting allows supplying medical vocabulary upfront. No dedicated medical model, but the general model handles domain-specific terms well with prompting.

**Integration:** WebSocket API, JavaScript/TypeScript SDK available. Clean REST API for batch. Well-documented.

**Verdict:** Best overall STT option for production -- excellent price/performance ratio with strong pt-BR support.

---

### 1.2 OpenAI Whisper API

**Overview:** OpenAI's Whisper is a general-purpose speech recognition model. The API version (whisper-1) offers batch transcription with high accuracy across many languages.

**pt-BR Support:**
- Trained on 680,000 hours of multilingual data
- Portuguese is a "high-resource" language, typically achieving 3-8% WER in ideal conditions
- Handles Brazilian accents, dialects, and background noise well
- Medium-resource category for specialized domains may push WER to 8-15%

**Streaming:** No native streaming support. Batch-only API -- audio must be uploaded as a complete file. This makes it unsuitable for real-time conversation without buffering workarounds.

**Pricing (Feb 2026):**
- Whisper-1: $0.006/min
- GPT-4o Mini Transcribe: $0.003/min (newer, cheaper alternative)
- GPT-4o Transcribe: $0.006/min

**Medical Terms:** Contextual prompting can help (supplying expected medical terms in the prompt parameter), but no dedicated medical model. Community reports suggest good accuracy for Portuguese medical terms with proper prompting.

**Integration:** REST API, simple file upload. No WebSocket streaming. Would require chunked recording and upload pattern for pseudo-real-time.

**Verdict:** Excellent accuracy and price for batch processing, but lack of streaming makes it unsuitable as the primary real-time STT. Useful as a backup for post-conversation transcription verification.

---

### 1.3 OpenAI Realtime API (STT component)

**Overview:** The Realtime API uses GPT-4o's native audio capabilities -- it is NOT a separate STT service but rather a unified speech-to-speech model that processes audio input directly.

**pt-BR Support:**
- GPT-4o is trained on extensive Portuguese data
- Community reports indicate Brazilian Portuguese works well
- The model inherits GPT-4o's language understanding, so medical terminology comprehension is strong
- Official language list only includes languages with <50% WER; Portuguese is supported

**Streaming:** Full-duplex streaming over WebSocket or WebRTC. Built-in Voice Activity Detection (VAD) with two modes:
- Server VAD: silence-based turn detection (default 500ms silence_duration)
- Semantic VAD: AI-powered detection of when user finished their thought

**Pricing (Feb 2026):**
- gpt-realtime: Audio input $32/1M tokens (~$0.06/min), Audio output $64/1M tokens (~$0.24/min)
- gpt-realtime-mini: Audio input $10/1M tokens, Audio output $20/1M tokens
- Text tokens also billed separately (system prompt is a major cost driver)

**Medical Terms:** Strongest medical comprehension of any option since the same model that transcribes also reasons about the content. Understands medical context natively.

**Integration:** WebSocket (server-to-server) or WebRTC (client-side). Requires ephemeral key generation from backend for security.

**Verdict:** Most capable option overall but significantly more expensive. See Section 3 for deep dive.

---

### 1.4 Web Speech API

**Overview:** Browser-native speech recognition API. Free, no API keys needed. Uses the browser's built-in speech engine (Chrome sends audio to Google's servers).

**pt-BR Support:**
- Supports pt-BR language code
- Quality depends on the browser engine (Chrome uses Google's cloud STT)
- Reasonable for common speech, struggles with domain-specific vocabulary

**Streaming:** Provides real-time interim results and final transcriptions. Event-driven API with `onresult` callbacks.

**Pricing:** Free -- no API costs.

**Limitations:**
- Only works in Chromium-based browsers (Chrome, Edge) -- ~50% cross-browser compatibility
- Requires internet (audio goes to Google's servers in Chrome)
- Privacy concern: audio sent to browser vendor -- problematic for LGPD compliance with health data
- No medical vocabulary customization
- Unreliable for long sessions -- may disconnect
- Cannot control quality or accuracy parameters
- No guaranteed SLA

**Medical Terms:** Poor. No customization possible. Domain-specific medical terms frequently misrecognized.

**Integration:** Simple JavaScript API, no server needed. Feature detection required for unsupported browsers.

**Verdict:** Useful only for development/prototyping and as a free fallback. Privacy concerns (LGPD) and medical vocabulary limitations disqualify it for production healthcare use.

---

### 1.5 AssemblyAI

**Overview:** AI company focused on speech understanding. Offers Universal-Streaming model with multilingual support.

**pt-BR Support:**
- Portuguese is supported in beta via universal-streaming-multilingual model
- Launched October 2025 with streaming multilingual support
- Still in beta for Portuguese -- quality may improve but not yet production-grade

**Streaming:** WebSocket-based real-time streaming. Unlimited concurrent streams with auto-scaling.

**Pricing (Feb 2026):**
- Base: $0.15/hour ($0.0025/min) for Universal streaming
- Add-ons cost extra: speaker ID +$0.02/hr, PII redaction +$0.08/hr, sentiment +$0.02/hr
- Billed on session duration (not audio length) -- expect ~65% overhead on short calls
- Free tier: 100 hours

**Medical Terms:** No dedicated medical model. Add-on features like entity detection available but may not cover Portuguese medical vocabulary.

**Integration:** WebSocket streaming API, JavaScript SDK available.

**Verdict:** Promising but Portuguese support is still in beta. Monitor for GA release. Good free tier for development.

---

### 1.6 Google Cloud Speech-to-Text

**Overview:** Google's enterprise STT service with V2 API and Chirp 2 model. Offers dedicated medical models.

**pt-BR Support:**
- 125+ languages including Portuguese (Brazilian)
- Chirp 2 model available for enhanced multilingual accuracy
- Medical models available: `medical_conversation` and `medical_dictation`

**Streaming:** Real-time streaming recognition via gRPC. Synchronous and asynchronous modes.

**Pricing (Feb 2026):**
- Standard: $0.016/min ($0.96/hr)
- Enhanced/Chirp: $0.024/min
- Medical models: up to $0.036/min (2x standard)
- Data logging opt-out adds 40% surcharge
- First 60 min/month free

**Medical Terms:** BEST dedicated medical model support of any service. `medical_conversation` and `medical_dictation` models are purpose-built. However, these models may have limited pt-BR vocabulary (optimized for English medical terms).

**Integration:** gRPC streaming, REST API, client libraries for many languages. More complex setup than Deepgram or OpenAI.

**Verdict:** Medical models are a strong advantage but pricing is 2-3x higher than Deepgram. Worth evaluating if pt-BR medical model accuracy proves superior in testing.

---

### 1.7 Azure Speech Services

**Overview:** Microsoft's speech AI platform with real-time transcription and custom model support.

**pt-BR Support:**
- Full pt-BR support for STT
- 50+ locales supported
- Custom speech models can be trained on domain-specific data

**Streaming:** Real-time streaming via WebSocket or Speech SDK.

**Pricing (Feb 2026):**
- Standard real-time: $1.00/hr ($0.0167/min)
- Batch: $0.36/hr ($0.006/min)
- Custom model hosting: additional costs
- Free tier: 5 hours/month

**Medical Terms:** Custom Speech allows training domain-specific models with medical vocabulary. Requires curated training data but offers best customization potential.

**Integration:** Speech SDK for JavaScript/TypeScript, REST API, WebSocket. Microsoft ecosystem integration.

**Verdict:** Strong customization for medical vocabulary via Custom Speech. Mid-range pricing. Good option if custom model training is pursued post-MVP.

---

### STT Comparison Matrix

| Service | pt-BR Quality | Latency | Streaming | Price/min | Medical Terms | Ease of Integration |
|---------|--------------|---------|-----------|-----------|---------------|---------------------|
| **Deepgram Nova-3** | Good (7-16% WER) | <300ms | Yes (WebSocket) | $0.0077 | Keyterm prompting | Easy (SDK) |
| **OpenAI Whisper** | Very Good (3-8% WER) | 1-5s (batch) | No | $0.006 | Prompt-based | Easy (REST) |
| **OpenAI Realtime** | Good | 250-300ms | Yes (WS/WebRTC) | ~$0.06 | Native LLM understanding | Medium |
| **Web Speech API** | Fair | <500ms | Yes (browser) | Free | None | Very Easy |
| **AssemblyAI** | Fair (beta) | <300ms | Yes (WebSocket) | $0.0025 | Limited | Easy (SDK) |
| **Google Cloud STT** | Good | <300ms | Yes (gRPC) | $0.016-$0.036 | Medical models | Medium (gRPC) |
| **Azure Speech** | Good | <300ms | Yes (SDK) | $0.0167 | Custom models | Medium (SDK) |

---

## 2. TTS Service Comparison

### 2.1 ElevenLabs

**Overview:** Industry leader in natural-sounding AI voices. Known for best-in-class quality and expressiveness.

**pt-BR Support:**
- Full Portuguese (Brazilian) support
- Turbo v2.5 model supports 32 languages including Portuguese
- 3,000+ voices available, including Portuguese-accented voices
- Voice cloning available for custom voices

**Quality & Naturalness:**
- Highest naturalness scores in benchmark tests
- Context awareness: 63.37% (vs OpenAI's 39.25%)
- Prosody accuracy: 64.57% (vs OpenAI's 45.83%)
- Pronunciation accuracy: 82% (vs OpenAI's 77%)

**Latency:**
- Turbo v2.5 (Flash): ~75ms TTFA (time to first audio byte)
- Multilingual v2: ~300ms TTFA
- Streaming supported via WebSocket

**Pricing (Feb 2026):**
- Free tier: 10,000 characters/month
- Starter: ~$5/month (30,000 characters)
- Creator: ~$22/month (100,000 characters)
- Pro: ~$99/month (500,000 characters)
- Scale: $330/month (2M credits = 4M characters with Turbo)
- Business: $1,320/month (11M credits)
- Standard models: 1 credit/character
- Turbo models: 0.5 credits/character
- Effective cost: ~$0.015-$0.030/1K characters depending on plan

**Integration:** REST API, WebSocket streaming, JavaScript SDK. Well-documented.

**Verdict:** Best voice quality for pt-BR. Higher cost than OpenAI but noticeably more natural. Recommended for production if budget allows.

---

### 2.2 OpenAI TTS

**Overview:** OpenAI offers multiple TTS models: tts-1 (standard), tts-1-hd (high definition), and the newer gpt-4o-mini-tts.

**pt-BR Support:**
- Supports Portuguese among 12+ languages
- Language detection is automatic based on input text
- Works well for pt-BR with natural intonation

**Quality & Naturalness:**
- tts-1: Good quality, optimized for speed
- tts-1-hd: Higher quality, slightly slower
- gpt-4o-mini-tts: Best quality, instruction-following capabilities (can control emotion, pace, style via text prompts)

**Latency:**
- tts-1: ~200ms TTFA
- tts-1-hd: ~300ms TTFA
- gpt-4o-mini-tts: ~150-200ms TTFA
- All support streaming output

**Voices Available:**
- 11 base voices: Alloy, Ash, Ballad, Coral, Echo, Fable, Nova, Onyx, Sage, Shimmer, Verse
- gpt-4o-mini-tts adds: Marin, Cedar
- No Portuguese-specific voices, but voices work across languages

**Pricing (Feb 2026):**
- tts-1: $15/1M characters ($0.015/1K chars)
- tts-1-hd: $30/1M characters ($0.030/1K chars)
- gpt-4o-mini-tts: $0.60/1M input tokens + $12/1M audio output tokens (~$0.015/min of audio)

**Integration:** REST API with streaming. Simple, well-documented. Audio formats: MP3, Opus, AAC, FLAC, WAV, PCM.

**Verdict:** Best balance of quality, price, and simplicity. gpt-4o-mini-tts is particularly compelling for its instruction-following capabilities (e.g., "speak in a warm, empathetic medical professional tone").

---

### 2.3 OpenAI Realtime API (TTS component)

**Overview:** Integrated TTS as part of the speech-to-speech pipeline. Not usable standalone.

**pt-BR Support:**
- Same quality as OpenAI TTS but natively integrated
- Voice inherits GPT-4o's multilingual capabilities

**Quality & Naturalness:**
- High quality, natural prosody
- Can express emotion and adjust tone contextually
- Voice quality comparable to tts-1-hd

**Latency:**
- Lowest possible latency since TTS starts immediately after LLM generates tokens
- No separate API call overhead
- ~250-300ms voice-to-voice total latency

**Voices Available:**
- Multiple voice options available through session configuration

**Pricing:**
- Included in Realtime API pricing (audio output: $64/1M tokens for gpt-realtime, $20/1M tokens for gpt-realtime-mini)
- Cannot be used independently of the full Realtime pipeline

**Integration:** Part of Realtime API WebSocket/WebRTC connection. No separate TTS API call needed.

**Verdict:** Excellent quality and lowest latency but cannot be used standalone. Only viable if using the full Realtime API pipeline.

---

### 2.4 Google Cloud TTS

**Overview:** Google's enterprise TTS with Standard, WaveNet, Neural2, and the new Gemini-2.5 TTS models.

**pt-BR Support:**
- Full pt-BR support with multiple voice options
- WaveNet and Neural2 models available for pt-BR
- Gemini-2.5 TTS Flash/Pro: 30 speakers across 80+ locales (includes pt-BR)
- Gemini TTS allows natural language control over style, accent, pace, emotion

**Quality & Naturalness:**
- Standard: Robotic, not suitable for medical conversations
- WaveNet: Good quality, natural sounding
- Neural2: Very good quality
- Gemini-2.5 TTS: Studio-quality, best from Google

**Latency:**
- Standard: <100ms
- WaveNet/Neural2: 200-400ms
- Gemini TTS: varies

**Pricing (Feb 2026):**
- Standard: $4/1M characters
- WaveNet: $16/1M characters (first 1M free/month)
- Neural2: $16/1M characters
- Gemini-2.5 TTS Flash: $0.50 input + $10.00 output per 1M tokens
- Gemini-2.5 TTS Pro: $1.00 input + $20.00 output per 1M tokens

**Integration:** REST API, gRPC, client libraries. SSML support for fine-grained control.

**Verdict:** Good quality and competitive pricing. Gemini TTS is very promising. Many pt-BR voice options. Consider as an alternative to OpenAI TTS.

---

### 2.5 Azure TTS

**Overview:** Microsoft's neural TTS with extensive pt-BR voice catalog.

**pt-BR Support:**
- 13+ neural voices for pt-BR (GA): DonatoNeural, FabioNeural, JulioNeural, NicolauNeural, ValerioNeural, LeticiaNeural, BrendaNeural, ElzaNeural, ManuelaNeural, GiovannaNeural, LeilaNeural, YaraNeural, HumbertoNeural
- 38 additional voices in preview as of late 2024
- BEST pt-BR voice catalog of any provider
- Speaking styles available (e.g., cheerful, empathetic)

**Quality & Naturalness:**
- Neural voices: High quality, natural sounding
- Some voices support speaking styles and emotional tones
- SSML support for fine-grained prosody control

**Latency:**
- Neural: 200-400ms
- Streaming supported

**Pricing (Feb 2026):**
- Neural TTS: $16/1M characters
- Long audio: $100/1M characters
- Free tier: 500K characters/month
- Custom Neural Voice: additional costs

**Integration:** Speech SDK (JavaScript/TypeScript), REST API, WebSocket. SSML support.

**Verdict:** Best pt-BR voice selection (13+ voices with distinct personalities). Good quality. Medium pricing. SSML support enables medical-appropriate tone control.

---

### 2.6 Web Speech Synthesis API

**Overview:** Browser-native TTS. Free, no API required.

**pt-BR Support:**
- Supports pt-BR in most browsers
- Voice quality depends on OS/browser (Google voices in Chrome, Microsoft voices in Edge)
- Limited voice options

**Quality & Naturalness:**
- Varies dramatically by browser/OS
- Generally robotic compared to cloud services
- Inconsistent across platforms

**Latency:**
- Very low (<100ms) since synthesis happens locally/in-browser

**Pricing:** Free.

**Limitations:**
- Inconsistent voice quality across browsers/platforms
- Limited SSML support
- Cannot guarantee specific voice availability
- Robotic sound not appropriate for empathetic medical conversation
- No streaming control

**Integration:** Simple JavaScript API (speechSynthesis.speak()).

**Verdict:** Free fallback only. Voice quality too low for medical conversations requiring warmth and empathy.

---

### TTS Comparison Matrix

| Service | pt-BR Quality | Naturalness | Latency | Streaming | Price/1K chars | Voices Available |
|---------|--------------|-------------|---------|-----------|----------------|------------------|
| **ElevenLabs** | Excellent | Excellent | 75-300ms | Yes (WS) | $0.015-$0.030 | 3,000+ (incl. pt-BR) |
| **OpenAI TTS** | Very Good | Very Good | 150-300ms | Yes | $0.015 (tts-1) | 13 (multilingual) |
| **OpenAI Realtime** | Very Good | Very Good | <300ms | Built-in | Bundled (~$0.24/min) | Multiple |
| **Google Cloud TTS** | Good-Excellent | Good-Excellent | 200-400ms | Yes | $0.004-$0.016 | 300+ (incl. pt-BR) |
| **Azure TTS** | Very Good | Very Good | 200-400ms | Yes | $0.016 | 13+ GA + 38 preview (pt-BR) |
| **Web Speech Synth** | Poor-Fair | Poor | <100ms | No | Free | OS-dependent |

---

## 3. OpenAI Realtime API Deep Dive

### 3.1 Architecture

The Realtime API is fundamentally different from traditional composed pipelines. Instead of chaining STT -> LLM -> TTS as separate services, it uses a **single multimodal model** (GPT-4o) that natively processes audio input and generates audio output.

```
Traditional Pipeline:
[Mic] -> [STT Service] -> [text] -> [LLM API] -> [text] -> [TTS Service] -> [Speaker]
         ~150ms              ~350-1000ms              ~200ms
         Total: ~700-1450ms

Realtime API:
[Mic] -> [GPT-4o Realtime] -> [Speaker]
         ~250-300ms total
```

**Connection Protocol:**
- **WebSocket**: Bidirectional event protocol over long-lived connection. Best for server-to-server.
- **WebRTC**: Recommended for client-side (browser). Handles variable network conditions better.
- **SIP**: For telephony integration (new in GA).

**Event Model:** Stateful protocol with events like `input_audio_buffer.append`, `conversation.item.create`, `response.create`, `response.audio.delta`, etc.

### 3.2 Capabilities

- **Unified STT + LLM + TTS**: Single API call handles entire voice conversation
- **Audio in, audio out**: Direct speech-to-speech without intermediate text
- **Text + audio**: Can also accept and produce text alongside audio
- **Function/tool calling**: Supports tool use within the conversation
- **Image input**: Can process images alongside audio (multimodal)
- **Interruption handling**: User can interrupt AI mid-speech
- **Context preservation**: Maintains conversation state across turns

### 3.3 Voice Activity Detection (VAD)

Two modes available:

1. **Server VAD** (default):
   - Silence-based: detects speech end via silence threshold
   - `silence_duration_ms` parameter (default: 500ms)
   - Can clip end of sentences if too aggressive
   - More sensitive to background noise than other implementations

2. **Semantic VAD** (newer):
   - AI-powered turn detection
   - Understands when user has finished their thought based on content
   - Better for medical interviews where patients pause to think
   - Reduces premature interruptions

### 3.4 Pricing Deep Dive

**gpt-realtime (full model):**
| Component | Price per 1M tokens | ~Price per minute |
|-----------|-------------------|-------------------|
| Audio input | $32.00 | ~$0.06 |
| Audio output | $64.00 | ~$0.24 |
| Cached audio input | $0.40 | ~$0.0008 |
| Text input | $4.00 | varies |
| Text output | $16.00 | varies |

**gpt-realtime-mini (cost-optimized):**
| Component | Price per 1M tokens | ~Price per minute |
|-----------|-------------------|-------------------|
| Audio input | $10.00 | ~$0.02 |
| Audio output | $20.00 | ~$0.08 |
| Text input | $0.60 | varies |
| Text output | $2.40 | varies |

**Cost Driver Warning:** The system prompt is the single biggest cost multiplier. It is re-processed with every turn, so a 2,000-token medical system prompt can add $0.01-0.05 per turn in hidden text token costs. Audio-out is the steepest meter.

### 3.5 Limitations and Constraints

1. **Session duration**: Maximum 60 minutes per session (increased from 15, then 30 min)
2. **Context window**: 128,000 tokens maximum
3. **No concurrent session limits** (as of Feb 2025), but rate limits still apply per tier
4. **VAD sensitivity**: Still buggy in noisy environments; may interrupt patients mid-sentence
5. **Language quality**: While Portuguese is supported, accuracy has not been independently benchmarked for pt-BR medical terms specifically
6. **No custom vocabulary**: Cannot boost specific medical terms like Deepgram's keyterm prompting
7. **Cost unpredictability**: Context accumulation over long conversations can cause costs to balloon unexpectedly
8. **Provider lock-in**: Cannot swap individual components (e.g., switch just the TTS while keeping the STT)
9. **No post-processing control**: Cannot apply custom medical NER or entity extraction to transcription before it reaches the LLM

### 3.6 Next.js Integration Pattern

```
Recommended Architecture:
1. Backend route: /api/realtime/session (POST)
   - Generates ephemeral token via OpenAI API
   - Returns token to client

2. Client-side:
   - Requests ephemeral token from backend
   - Opens WebRTC connection directly to OpenAI
   - Captures mic at 16kHz mono, 20-40ms chunks
   - Handles audio playback from response stream

3. Security:
   - NEVER expose API key in browser
   - Ephemeral tokens have limited lifetime
   - Backend validates user session before issuing token
```

There is an open-source Next.js 15 starter template with WebRTC integration available at: https://github.com/cameronking4/openai-realtime-api-nextjs

### 3.7 Pros vs Cons: Realtime API vs Composed Pipeline

| Aspect | Realtime API | Composed Pipeline |
|--------|-------------|-------------------|
| **Latency** | 250-300ms (best) | 700-1450ms (good with streaming) |
| **Architecture** | Simple (1 connection) | Complex (3+ services) |
| **Cost (10 min)** | ~$3.00 (gpt-realtime) / ~$1.00 (mini) | ~$0.50-$0.90 |
| **pt-BR Medical** | Good (native understanding) | Configurable (keyterm boosting) |
| **Flexibility** | Low (all-or-nothing) | High (swap any component) |
| **Session limit** | 60 min max | None |
| **Vendor lock-in** | High (OpenAI only) | Low (mix providers) |
| **Error recovery** | Session restart needed | Component-level retry |
| **Voice quality** | Very Good | Configurable (ElevenLabs = Excellent) |
| **Debugging** | Hard (black box) | Easy (log each step) |

---

## 4. Integration Patterns

### 4.1 STT Integration

**Deepgram (Recommended):**
```
Pattern: WebSocket streaming
Client [MediaRecorder/AudioWorklet] -> Next.js API Route (WebSocket proxy) -> Deepgram WebSocket
- Auth: API key in backend, never exposed to client
- Audio: 16kHz, 16-bit PCM or Opus codec
- Events: Interim results (partial), final results
- Reconnection: Built-in SDK reconnection logic
```

**OpenAI Whisper (Batch fallback):**
```
Pattern: REST file upload
Client [MediaRecorder] -> Save audio blob -> POST /api/transcribe -> OpenAI /v1/audio/transcriptions
- Audio format: mp3, wav, webm (max 25MB)
- Useful for: post-conversation full transcription verification
```

### 4.2 TTS Integration

**OpenAI TTS (Recommended):**
```
Pattern: Streaming REST
Next.js API Route -> POST /v1/audio/speech (stream: true) -> Pipe audio chunks to client
- Client: AudioContext + AudioWorklet for playback
- Format: Opus (lowest latency) or PCM for real-time
- Streaming: Response body is streamed, play audio as chunks arrive
```

**ElevenLabs (Premium option):**
```
Pattern: WebSocket streaming
Next.js API Route -> ElevenLabs WebSocket -> Audio chunks to client
- Model: Turbo v2.5 for lowest latency
- Format: PCM or MP3 streaming
- Optimization: Use `optimize_streaming_latency` parameter
```

### 4.3 Full Pipeline Architecture

```
Browser Client                    Next.js Backend                    External Services
--------------                    ---------------                    -----------------
[Mic capture]  -- WebSocket -->   [/api/voice/stream]  -- WS -->    [Deepgram STT]
                                       |
                                  [Process text]
                                       |
                                  [/api/llm/respond]   -- REST -->  [OpenAI/Anthropic LLM]
                                       |
                                  [/api/voice/speak]   -- REST -->  [OpenAI TTS]
                                       |
[Audio playback] <-- WS/SSE --   [Stream audio back]
```

### 4.4 Authentication & API Key Management

- All API keys stored as server-side environment variables
- Next.js API routes act as proxies -- client never sees keys
- For Realtime API: backend generates ephemeral tokens
- Rate limiting at the API route level to prevent abuse
- Per-user usage tracking for cost management

### 4.5 Error Handling & Fallback Strategy

```
Primary:   Deepgram Nova-3 STT -> OpenAI LLM -> OpenAI gpt-4o-mini-tts
Fallback 1: OpenAI Whisper (batch) -> OpenAI LLM -> OpenAI tts-1
Fallback 2: Web Speech API -> OpenAI LLM -> Web Speech Synthesis
Fallback 3: Text-only mode (typing) -> OpenAI LLM -> Text display
```

- Automatic fallback on service failure (timeout, 5xx, rate limit)
- Exponential backoff with jitter on retries
- Client-side health checks before starting session
- Graceful degradation to text-only mode as last resort

### 4.6 Rate Limits & Concurrency

| Service | Concurrent Connections | Rate Limit |
|---------|----------------------|------------|
| Deepgram | Unlimited (pay-as-you-go) | No hard limit |
| OpenAI Whisper | N/A (batch) | Tier-dependent |
| OpenAI Realtime | No limit (as of Feb 2025) | Tier-dependent |
| OpenAI TTS | Tier-dependent | 500 RPM (Tier 1) |
| ElevenLabs | Plan-dependent | Varies by plan |
| AssemblyAI | 100 streams/min (auto-scales) | Auto-scaling |

---

## 5. Cost Analysis

### 5.1 Assumptions

- Average triage conversation: 10 minutes total
- Patient speech: ~5 minutes (audio input)
- AI speech: ~5 minutes (audio output)
- AI text response: ~2,000 characters per response, ~10 responses = 20,000 characters
- LLM cost (GPT-4o-mini): ~$0.03 per conversation (estimated)

### 5.2 Cost Per Conversation (10 min)

#### Option A: Composed Pipeline (Primary Recommendation)
| Component | Service | Calculation | Cost |
|-----------|---------|-------------|------|
| STT | Deepgram Nova-3 | 5 min x $0.0077/min | $0.039 |
| LLM | GPT-4o-mini | ~20K tokens | $0.030 |
| TTS | OpenAI gpt-4o-mini-tts | ~20K chars, 5 min audio | $0.075 |
| **Total** | | | **$0.144** |

#### Option B: Premium Composed Pipeline
| Component | Service | Calculation | Cost |
|-----------|---------|-------------|------|
| STT | Deepgram Nova-3 | 5 min x $0.0077/min | $0.039 |
| LLM | GPT-4o | ~20K tokens | $0.100 |
| TTS | ElevenLabs Turbo v2.5 | ~20K chars | $0.300 |
| **Total** | | | **$0.439** |

#### Option C: OpenAI Realtime API (gpt-realtime-mini)
| Component | Calculation | Cost |
|-----------|-------------|------|
| Audio input | 5 min x ~$0.02/min | $0.100 |
| Audio output | 5 min x ~$0.08/min | $0.400 |
| Text tokens (system prompt, context) | ~50K tokens | $0.150 |
| **Total** | | **$0.650** |

#### Option D: OpenAI Realtime API (gpt-realtime full)
| Component | Calculation | Cost |
|-----------|-------------|------|
| Audio input | 5 min x $0.06/min | $0.300 |
| Audio output | 5 min x $0.24/min | $1.200 |
| Text tokens (system prompt, context) | ~50K tokens | $0.400 |
| **Total** | | **$1.900** |

#### Option E: Free/Minimal Cost (Development)
| Component | Service | Cost |
|-----------|---------|------|
| STT | Web Speech API | Free |
| LLM | GPT-4o-mini | $0.030 |
| TTS | Web Speech Synthesis | Free |
| **Total** | | **$0.030** |

### 5.3 Monthly Cost at Scale

| Volume | Option A (Composed) | Option C (Realtime Mini) | Option D (Realtime Full) |
|--------|--------------------|-----------------------|------------------------|
| 10 conv/day (300/mo) | $43 | $195 | $570 |
| 100 conv/day (3,000/mo) | $432 | $1,950 | $5,700 |
| 1,000 conv/day (30,000/mo) | $4,320 | $19,500 | $57,000 |

### 5.4 Free Tier Availability for Development

| Service | Free Tier |
|---------|-----------|
| Deepgram | $200 credits (~26,000 min streaming) |
| OpenAI | No free tier (pay-as-you-go from $5) |
| ElevenLabs | 10,000 chars/month |
| Google Cloud STT | 60 min/month |
| Google Cloud TTS | 1M WaveNet chars/month |
| Azure STT | 5 hours/month |
| Azure TTS | 500K chars/month |
| AssemblyAI | 100 hours |
| Web Speech API | Unlimited (free) |
| Web Speech Synthesis | Unlimited (free) |

---

## 6. pt-BR Specific Considerations

### 6.1 Accent Variations in Brazil

Brazil has significant regional accent diversity that STT must handle:

| Region | Accent | Key Characteristics |
|--------|--------|-------------------|
| Sao Paulo | Paulista | Retroflex "r", clear "s" |
| Rio de Janeiro | Carioca | Palatalized "t/d" before "i", "sh" for final "s" |
| Minas Gerais | Mineiro | Shortened words, "trem" as generic noun |
| Northeast | Nordestino | Open vowels, distinct "r", faster cadence |
| South | Sulista/Gaucho | Closer to Rioplatense Spanish influences |
| North | Nortista | Nasal vowels, indigenous influences |

**Impact on STT:** Deepgram and Google Cloud handle accent variation well due to large training corpora. OpenAI Whisper has broad Portuguese training data. Web Speech API (Chrome/Google) handles major accents but struggles with strong regional variations.

### 6.2 Medical Terminology in Portuguese

Key medical terms the STT must accurately transcribe:

| Portuguese Term | English Equivalent | Difficulty |
|----------------|-------------------|------------|
| Anamnese | Medical history taking | Medium |
| Queixa principal (QP) | Chief complaint | Low |
| Historia da doenca atual (HDA) | History of present illness | Medium |
| Antecedentes pessoais | Past medical history | Low |
| Antecedentes familiares | Family history | Low |
| Alergias medicamentosas | Drug allergies | High |
| Cefaleia | Headache | Medium |
| Dispneia | Dyspnea/shortness of breath | High |
| Precordialgia | Chest pain | High |
| Edema | Swelling | Low |
| Hipertensao arterial | Hypertension | Medium |
| Diabetes mellitus | Diabetes | Low |
| Pressao arterial | Blood pressure | Low |
| Tontura | Dizziness | Low |
| Nausea/vomito | Nausea/vomiting | Low |

**Mitigation strategies:**
1. Deepgram keyterm prompting: Supply medical terms list at session start
2. OpenAI Whisper prompt parameter: Include expected medical terms
3. Post-processing: Medical term normalization layer
4. Hybrid: Use LLM to correct likely medical term errors in transcription

### 6.3 Regional Slang and Colloquialisms

Patients may use informal language for symptoms:

| Colloquial Expression | Medical Meaning |
|----------------------|-----------------|
| "Dor de cabeca" | Cefaleia (headache) |
| "Falta de ar" | Dispneia (dyspnea) |
| "Dor no peito" | Precordialgia (chest pain) |
| "Barriga inchada" | Distensao abdominal (abdominal distension) |
| "Tontura" / "Cabeca rodando" | Vertigem (vertigo) |
| "Azia" | Pirose (heartburn) |
| "Dormencia" | Parestesia (paresthesia) |
| "Quentura" (NE slang) | Febre (fever) |
| "Trem" (MG) | Generic noun (anything) |
| "Dodoi" (informal) | Dor/lesao (pain/injury) |

**Impact:** The LLM layer must translate colloquial patient language into proper medical terminology. This happens regardless of STT accuracy -- it is an LLM concern. However, STT must first correctly capture these informal terms.

### 6.4 Which Services Handle pt-BR Best?

**Ranking for pt-BR quality (based on available data):**

1. **Google Cloud STT** -- Largest Portuguese training corpus, medical models available
2. **OpenAI Whisper** -- Extensive multilingual training, good pt-BR WER
3. **Deepgram Nova-3** -- Good pt-BR support (Tier 2), keyterm prompting advantage
4. **Azure Speech** -- Full pt-BR support, custom model capability
5. **OpenAI Realtime API** -- Inherits GPT-4o Portuguese capabilities
6. **AssemblyAI** -- Portuguese in beta, improving
7. **Web Speech API** -- Depends on browser engine (Chrome = Google quality)

**For TTS pt-BR:**

1. **Azure TTS** -- 13+ dedicated pt-BR voices (most options)
2. **ElevenLabs** -- Best naturalness, Portuguese supported
3. **Google Cloud TTS** -- Multiple pt-BR voices, Gemini TTS promising
4. **OpenAI TTS** -- Good pt-BR but no dedicated Portuguese voices
5. **Web Speech Synthesis** -- OS-dependent, inconsistent

---

## 7. Latency Budget

### 7.1 Target

**Goal:** Conversation feels natural with < 1 second response time from end of patient speech to start of AI speech.

Reference: Human conversations operate within 300-500ms response window. Delays beyond 500ms feel unnatural. ITU-T recommends < 150ms for best quality, < 400ms for acceptable quality.

### 7.2 Latency Breakdown: Composed Pipeline

| Stage | Component | Best Case | Typical | Worst Case |
|-------|-----------|-----------|---------|------------|
| 1 | End-of-speech detection | 50ms | 200ms | 500ms |
| 2 | STT final result (Deepgram) | 100ms | 200ms | 400ms |
| 3 | LLM first token (GPT-4o-mini) | 150ms | 350ms | 800ms |
| 4 | TTS first audio byte | 100ms | 200ms | 400ms |
| 5 | Network overhead | 30ms | 80ms | 200ms |
| **Total** | | **430ms** | **1,030ms** | **2,300ms** |

### 7.3 Latency Breakdown: Realtime API

| Stage | Component | Best Case | Typical | Worst Case |
|-------|-----------|-----------|---------|------------|
| 1 | End-of-speech (built-in VAD) | 30ms | 150ms | 500ms |
| 2 | Model processing + first audio | 150ms | 250ms | 500ms |
| 3 | Network overhead | 20ms | 50ms | 150ms |
| **Total** | | **200ms** | **450ms** | **1,150ms** |

### 7.4 Streaming Optimization Strategies

To reduce perceived latency in the composed pipeline:

1. **Streaming STT -> Streaming LLM:**
   - Send partial STT results to LLM speculatively
   - LLM begins generating response before patient finishes speaking
   - Cancel and restart if final STT differs significantly from partial
   - Saves: 100-300ms

2. **Streaming LLM -> Streaming TTS:**
   - Feed LLM output tokens directly to TTS as they arrive
   - TTS begins generating audio from first sentence fragment
   - Client starts playing audio while rest is still generating
   - Saves: 200-500ms

3. **Sentence-level pipelining:**
   - Split LLM response into sentences
   - Start TTS for sentence 1 while sentence 2 is generating
   - Client plays sentence 1 while sentence 2 TTS is processing
   - Saves: 300-600ms

4. **Pre-buffering:**
   - Generate common filler responses ("Entendo...", "Certo...") in advance
   - Play these immediately while actual response generates
   - Saves: 200-400ms (perceived)

**With full streaming optimization, the composed pipeline can achieve ~500-700ms perceived latency**, which approaches the Realtime API's performance.

### 7.5 Recommendation for Latency

| Approach | Achievable Latency | Complexity |
|----------|-------------------|------------|
| Realtime API (gpt-realtime-mini) | 300-500ms | Low |
| Composed with full streaming | 500-700ms | High |
| Composed without streaming optimization | 800-1500ms | Medium |
| Batch approach (Whisper + TTS) | 3-10s | Low |

For MVP: Accept 800-1200ms with basic streaming. Optimize to 500-700ms in later iterations.

---

## Recommendations

### Primary Recommendation: Composed Pipeline

**STT: Deepgram Nova-3** + **LLM: GPT-4o-mini** + **TTS: OpenAI gpt-4o-mini-tts**

Rationale:
- Best cost efficiency ($0.14/conversation)
- Strong pt-BR support with keyterm prompting for medical terms
- Architectural flexibility to swap any component
- No session time limits (important for lengthy medical histories)
- Streaming capabilities for good latency
- Deepgram's $200 free credit covers extensive development/testing
- gpt-4o-mini-tts supports instruction-following for empathetic tone

### Secondary Recommendation: OpenAI Realtime API (gpt-realtime-mini)

Rationale:
- Lowest latency (300-500ms) for most natural conversation
- Simplest architecture (one connection handles everything)
- Built-in VAD with Semantic mode (great for medical interviews)
- ~4.5x more expensive than composed pipeline
- 60-minute session limit may be acceptable for triage (most < 15 min)
- Worth prototyping to compare conversation quality

### Fallback: Web Speech API + Web Speech Synthesis

Rationale:
- Zero cost for development and testing
- Works for basic functionality validation
- Acceptable for prototyping UI and conversation flow
- Not suitable for production due to LGPD privacy concerns and medical vocabulary limitations

### Upgrade Path (Post-MVP)

1. Swap TTS to **ElevenLabs Turbo v2.5** for superior voice quality if user feedback indicates voice naturalness matters
2. Add **Google Cloud STT medical model** as secondary STT to validate medical term accuracy
3. Consider **Azure TTS** for pt-BR voice variety (13+ voices to find the most appropriate "medical agent" voice)
4. Implement full streaming pipeline optimization to reach 500-700ms latency

---

## Open Questions

1. **Deepgram Nova-3 pt-BR medical accuracy**: No independent benchmark exists for Portuguese medical terminology with Deepgram. Need to run our own evaluation with a curated test set of medical conversations in pt-BR.

2. **OpenAI Realtime API pt-BR quality**: How well does gpt-realtime-mini handle Brazilian accents (especially nordestino and strong regional variants)? Need hands-on testing.

3. **ElevenLabs pt-BR voice selection**: Which specific ElevenLabs voice sounds most appropriate for a medical triage agent? Need voice auditions with Portuguese medical scripts.

4. **Semantic VAD for Portuguese**: Does OpenAI's Semantic VAD work well with Portuguese sentence structure, or is it optimized for English? Portuguese has different pause patterns.

5. **Session duration for complex cases**: Will 60 minutes be enough for complex medical histories? If not, what is the reconnection strategy for the Realtime API?

6. **LGPD compliance for audio processing**: Which services provide data processing agreements (DPA) compatible with LGPD? Where is audio data stored and for how long? This is critical for health data.

7. **Cost at scale with context accumulation**: For the Realtime API, how much does context window growth actually cost over a 10-minute conversation? Need real-world measurement.

8. **OpenAI gpt-4o-mini-tts instruction following**: How well does the instruction-following TTS model maintain an empathetic medical tone in Portuguese throughout a long conversation?

9. **Deepgram TTS (Aura-2) Portuguese timeline**: Deepgram's Aura-2 TTS does not currently support Portuguese. If/when it adds pt-BR, it could become the best integrated STT+TTS option with Deepgram.

10. **Google Gemini 2.5 TTS quality for pt-BR**: The new Gemini TTS models with natural language style control are very promising but need evaluation for pt-BR medical context.

---

## Sources

### STT Services
- [Deepgram Pricing](https://deepgram.com/pricing) -- Official pricing page, verified Feb 2026. Confidence: HIGH.
- [Deepgram Nova-3 Portuguese Support](https://deepgram.com/learn/deepgram-expands-nova-3-with-spanish-french-and-portuguese-support) -- Language expansion announcement. Confidence: HIGH.
- [Deepgram Nova-3 Introduction](https://deepgram.com/learn/introducing-nova-3-speech-to-text-api) -- Model capabilities and benchmarks. Confidence: HIGH.
- [Deepgram Pricing Breakdown (BrassTranscripts)](https://brasstranscripts.com/blog/deepgram-pricing-per-minute-2025-real-time-vs-batch) -- Third-party pricing analysis, Jan 2026. Confidence: HIGH.
- [OpenAI API Pricing](https://platform.openai.com/docs/pricing) -- Official pricing page. Confidence: HIGH.
- [OpenAI Whisper Pricing (CostGoat)](https://costgoat.com/pricing/openai-transcription) -- Calculator verified Feb 2026. Confidence: HIGH.
- [AssemblyAI Pricing](https://www.assemblyai.com/pricing) -- Official pricing page. Confidence: HIGH.
- [AssemblyAI Multilingual Streaming](https://www.assemblyai.com/blog/introducing-multilingual-universal-streaming) -- Portuguese beta announcement. Confidence: HIGH.
- [AssemblyAI Pricing Analysis (BrassTranscripts)](https://brasstranscripts.com/blog/assemblyai-pricing-per-minute-2025-real-costs) -- Third-party analysis. Confidence: MEDIUM.
- [Google Cloud STT Pricing](https://cloud.google.com/speech-to-text/pricing) -- Official pricing page. Confidence: HIGH.
- [Google Cloud STT Pricing Analysis (BrassTranscripts)](https://brasstranscripts.com/blog/google-cloud-speech-to-text-pricing-2025-gcp-integration-costs) -- Third-party analysis. Confidence: MEDIUM.
- [Azure Speech Pricing](https://azure.microsoft.com/en-us/pricing/details/speech/) -- Official pricing page. Confidence: HIGH.
- [Azure Speech Pricing Analysis (BrassTranscripts)](https://brasstranscripts.com/blog/azure-speech-services-pricing-2025-microsoft-ecosystem-costs) -- Third-party analysis. Confidence: MEDIUM.
- [Web Speech API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) -- API documentation. Confidence: HIGH.
- [Web Speech API Browser Support (CanIUse)](https://caniuse.com/speech-recognition) -- Browser compatibility data. Confidence: HIGH.

### TTS Services
- [ElevenLabs API Pricing](https://elevenlabs.io/pricing/api) -- Official pricing page. Confidence: HIGH.
- [ElevenLabs Portuguese Voices](https://elevenlabs.io/text-to-speech/portuguese) -- Voice catalog. Confidence: HIGH.
- [ElevenLabs Turbo v2.5 Launch](https://elevenlabs.io/blog/introducing-turbo-v25) -- Model capabilities. Confidence: HIGH.
- [ElevenLabs Models Documentation](https://elevenlabs.io/docs/overview/models) -- Model details. Confidence: HIGH.
- [ElevenLabs Pricing Breakdown (FlexPrice)](https://flexprice.io/blog/elevenlabs-pricing-breakdown) -- Third-party analysis. Confidence: MEDIUM.
- [OpenAI TTS Pricing (CostGoat)](https://costgoat.com/pricing/openai-tts) -- Calculator verified Feb 2026. Confidence: HIGH.
- [OpenAI TTS API Pricing Gotchas](https://community.openai.com/t/new-tts-api-pricing-and-gotchas/1150616) -- Community discussion on pricing nuances. Confidence: MEDIUM.
- [Google Cloud TTS Pricing](https://cloud.google.com/text-to-speech/pricing) -- Official pricing page. Confidence: HIGH.
- [Google Gemini TTS Documentation](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts) -- Gemini TTS capabilities. Confidence: HIGH.
- [Azure pt-BR Neural Voices](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support) -- Voice catalog. Confidence: HIGH.
- [Azure pt-BR TTS Launch](https://techcommunity.microsoft.com/t5/azure-ai/cognitive-services-adds-brazilian-portuguese-to-neural-text-to/ba-p/1210471) -- Voice additions. Confidence: HIGH.
- [Deepgram Aura-2 TTS](https://deepgram.com/learn/introducing-aura-2-enterprise-text-to-speech) -- TTS model (no pt-BR). Confidence: HIGH.

### OpenAI Realtime API
- [OpenAI Realtime API Guide](https://platform.openai.com/docs/guides/realtime) -- Official documentation. Confidence: HIGH.
- [OpenAI Realtime WebSocket Guide](https://platform.openai.com/docs/guides/realtime-websocket) -- WebSocket integration. Confidence: HIGH.
- [OpenAI Realtime VAD Documentation](https://platform.openai.com/docs/guides/realtime-vad) -- VAD configuration. Confidence: HIGH.
- [OpenAI Realtime Cost Management](https://platform.openai.com/docs/guides/realtime-costs) -- Cost optimization guide. Confidence: HIGH.
- [OpenAI Realtime API - The Missing Manual (Latent Space)](https://www.latent.space/p/realtime-api) -- Deep technical analysis. Confidence: MEDIUM.
- [OpenAI Realtime Pricing Calculator (Skywork)](https://skywork.ai/blog/agent/openai-realtime-api-pricing-2025-cost-calculator/) -- Cost calculator. Confidence: MEDIUM.
- [gpt-realtime-mini Pricing Breakdown (eesel.ai)](https://www.eesel.ai/blog/gpt-realtime-mini-pricing) -- Cost analysis. Confidence: MEDIUM.
- [Introducing gpt-realtime (OpenAI)](https://openai.com/index/introducing-gpt-realtime/) -- GA announcement. Confidence: HIGH.
- [OpenAI Realtime Next.js Starter (GitHub)](https://github.com/cameronking4/openai-realtime-api-nextjs) -- Reference implementation. Confidence: HIGH.
- [Realtime API Session Limits Discussion](https://community.openai.com/t/realtime-api-hows-everyone-managing-longer-than-30min-sessions/1144295) -- Session management patterns. Confidence: MEDIUM.

### Architecture & Latency
- [Real-Time vs Turn-Based Voice Agent Architecture (Softcery)](https://softcery.com/lab/ai-voice-agents-real-time-vs-turn-based-tts-stt-architecture) -- Architecture comparison. Confidence: HIGH.
- [Voice AI Infrastructure Guide (Introl)](https://introl.com/blog/voice-ai-infrastructure-real-time-speech-agents-asr-tts-guide-2025) -- Infrastructure patterns. Confidence: HIGH.
- [Engineering for Voice Agent Latency (Cresta)](https://cresta.com/blog/engineering-for-real-time-voice-agent-latency) -- Latency optimization. Confidence: HIGH.
- [Lowest Latency Voice Agent with Vapi (AssemblyAI)](https://www.assemblyai.com/blog/how-to-build-lowest-latency-voice-agent-vapi) -- Latency benchmarks. Confidence: HIGH.
- [Voice AI Latency Guide (Hamming AI)](https://hamming.ai/resources/voice-ai-latency-whats-fast-whats-slow-how-to-fix-it) -- Latency targets. Confidence: HIGH.
- [AI Voice Agent Cost Calculator (Softcery)](https://softcery.com/ai-voice-agents-calculator) -- Cost comparison tool. Confidence: MEDIUM.

### Comparisons & Benchmarks
- [ElevenLabs vs OpenAI TTS (Vapi)](https://vapi.ai/blog/elevenlabs-vs-openai) -- Quality comparison. Confidence: MEDIUM.
- [How to Choose STT and TTS for Voice Agents (Softcery)](https://softcery.com/lab/how-to-choose-stt-tts-for-ai-voice-agents-in-2025-a-comprehensive-guide) -- Comprehensive comparison. Confidence: HIGH.
- [Deepgram vs OpenAI vs Google STT](https://deepgram.com/learn/deepgram-vs-openai-vs-google-stt-accuracy-latency-price-compared) -- Accuracy/latency comparison. Confidence: MEDIUM (Deepgram-authored).
- [Best TTS APIs 2026 (Speechmatics)](https://www.speechmatics.com/company/articles-and-news/best-tts-apis-in-2025-top-12-text-to-speech-services-for-developers) -- Industry survey. Confidence: MEDIUM.

### pt-BR Medical Speech Recognition
- [MedTalkAI: Assisted Anamnesis with ASR (SBC)](https://sol.sbc.org.br/index.php/sbbd_estendido/article/view/30775) -- Brazilian research on medical STT. Confidence: HIGH.
- [Speech Recognition for Portuguese Medical Reports (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S1386505618302879) -- Academic paper. Confidence: HIGH.
- [CORAA ASR Brazilian Portuguese Corpus (Springer)](https://link.springer.com/article/10.1007/s10579-022-09621-4) -- pt-BR speech corpus. Confidence: HIGH.
- [Brazilian Portuguese Wav2Vec 2.0 (ACM)](https://dl.acm.org/doi/10.1007/978-3-030-98305-5_31) -- STT research for pt-BR. Confidence: HIGH.
- [Web Speech API vs Cloud APIs (VocaFuse)](https://vocafuse.com/blog/web-speech-api-vs-cloud-apis/) -- Quality comparison. Confidence: MEDIUM.
