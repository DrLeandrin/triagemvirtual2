# Research C: VAD & Voice UI Patterns
**Researcher:** Agent C
**Date:** 2026-02-08
**Confidence:** HIGH (core VAD/UI topics), MEDIUM (mobile edge cases, accessibility conflicts)

## Executive Summary

Voice Activity Detection (VAD) is the critical subsystem that determines when a patient has finished speaking and when the AI agent should respond. For a medical triage application where patients may pause to think, cry, or speak hesitantly, choosing the right VAD strategy and turn detection approach is arguably the most important UX decision in the entire voice pipeline.

The recommended approach for our MVP is to use **@ricky0123/vad-web** with Silero VAD v5 for client-side speech detection, combined with a **generous silence threshold (1200-1500ms)** tuned for medical conversations. For the voice UI, a **CSS/Tailwind-animated orb** provides the best balance of visual polish and implementation simplicity. The triage screen should use a **full-screen immersive layout** with real-time transcription, an emergency stop button, and clear state indicators (listening/processing/speaking). If we adopt the OpenAI Realtime API (from Researcher B's findings), its built-in **semantic_vad** with "low" eagerness is the strongest option for medical turn detection, as it uses semantic understanding rather than fixed silence thresholds.

Accessibility must be baked in from the start: ARIA live regions for state changes, `prefers-reduced-motion` support for animations, a text-based fallback for the entire voice interaction, and careful focus management. Mobile constraints (especially iOS Safari's autoplay policies and background tab restrictions) require explicit user-gesture-gated audio initialization and a clear UX warning about keeping the screen active.

---

## 1. Voice Activity Detection (VAD) Libraries

### 1.1 @ricky0123/vad-web (Silero VAD wrapper)

**What it is:** A browser-ready wrapper that runs the Silero VAD ONNX model via ONNX Runtime Web. Provides a simple API with React hooks (`useMicVAD` from `@ricky0123/vad-react`).

**Current version:** 0.0.30 (npm, published late 2025)

**How it works:**
- Loads the Silero ONNX model (legacy or v5) in the browser
- Uses an AudioWorklet for real-time audio processing
- Processes audio frames and outputs a speech probability (0-1)
- Fires `onSpeechStart` and `onSpeechEnd` callbacks

**Key configuration parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `positiveSpeechThreshold` | number | ~0.5 | Probability above which a frame is considered speech |
| `negativeSpeechThreshold` | number | ~0.35 | Probability below which a frame is considered silence |
| `redemptionFrames` | number | 8 | Number of silence frames to wait before declaring speech end (grace period) |
| `minSpeechFrames` | number | 3 | Minimum speech frames to avoid false positives; below this triggers `onVADMisfire` |
| `model` | string | "legacy" | Set to "v5" to use Silero v5 model |
| `startOnLoad` | boolean | false | Auto-start listening when component mounts |

**React integration:**
```typescript
import { useMicVAD } from "@ricky0123/vad-react"

const vad = useMicVAD({
  model: "v5",
  startOnLoad: true,
  positiveSpeechThreshold: 0.6,
  minSpeechFrames: 5,
  redemptionFrames: 12, // more generous for medical context
  onSpeechStart: () => { /* update UI to "listening" */ },
  onSpeechEnd: (audio) => { /* send audio to STT */ },
  onVADMisfire: () => { /* ignore false positive */ },
})
```

**Bundle size:** The JS wrapper itself is small (~15-20 KB), but it requires:
- `silero_vad_v5.onnx` model: ~2 MB
- `onnxruntime-web` WASM files: ~5-8 MB
- `vad.worklet.bundle.min.js`: ~10 KB
- Total effective download: **~7-10 MB** (loaded lazily from CDN by default)

**Accuracy (Silero v5 via this wrapper):**
- 87.7% True Positive Rate at 5% False Positive Rate
- Processing speed: 189 microseconds per chunk at 16kHz
- 4x fewer errors than WebRTC VAD

**Browser support:** Chrome, Firefox, Safari, Edge (requires WebAssembly + AudioWorklet support)

**Strengths:**
- Best accuracy-to-ease-of-use ratio for browser VAD
- Active maintenance and community
- React hooks ready (`@ricky0123/vad-react`)
- Configurable parameters for fine-tuning
- CDN-loadable assets (no bundling headaches)

**Weaknesses:**
- Large initial download (~7-10 MB for ONNX + WASM)
- Silero v5 may require re-tuning parameters from v4/legacy
- AudioWorklet required (no fallback for very old browsers)

**Confidence:** HIGH

---

### 1.2 Silero VAD (Direct ONNX)

**What it is:** The underlying pre-trained enterprise-grade VAD model from Silero Team, available as ONNX files.

**How to run in browser:**
- Load `silero_vad_v5.onnx` with `onnxruntime-web`
- Feed 16kHz PCM audio frames (512 samples per frame for v5)
- Model outputs speech probability per frame
- Implement your own speech start/end logic

**Accuracy metrics (from Picovoice benchmark and Silero wiki):**
| Metric | Value |
|--------|-------|
| TPR at 5% FPR | 87.7% |
| Processing speed (v5 ONNX) | 189 us/chunk at 16kHz |
| Compared to WebRTC VAD | 4x fewer errors |
| Compared to Cobra VAD | 3x more errors |
| Model size (v5) | ~2 MB |

**When to use directly:** Only if `@ricky0123/vad-web` does not provide enough control over the audio pipeline or if you need custom frame processing logic. For most cases, the wrapper is preferable.

**Confidence:** HIGH

---

### 1.3 Energy-Based VAD

**What it is:** The simplest VAD approach -- compute the short-time energy (sum of squared samples) of audio frames and compare against a threshold.

**Implementation:**
```typescript
function isVoiceFrame(samples: Float32Array, threshold: number): boolean {
  let energy = 0
  for (let i = 0; i < samples.length; i++) {
    energy += samples[i] * samples[i]
  }
  energy /= samples.length
  return energy > threshold
}
```

**Pros:**
- Extremely simple to implement (~20 lines of code)
- No external dependencies
- Near-zero latency
- Negligible CPU usage
- Works offline without any model download

**Cons:**
- Threshold selection is extremely difficult -- too low catches noise, too high misses quiet speech
- Fails in noisy environments (keyboard clicks, HVAC, TV in background)
- Cannot distinguish speech from other sounds (coughs, sneezes, door slams)
- Tends to oversegment (many false start/stop events)
- No adaptation to varying volume levels
- Misses low-energy speech consonants and trailing sounds

**When sufficient:** Only as a quick fallback or for initial prototyping. Not suitable for a medical application where accuracy matters.

**Confidence:** HIGH (assessment is well-established)

---

### 1.4 WebRTC Built-in VAD

**What it is:** Google's open-source VAD engine built into the WebRTC audio pipeline. Uses traditional signal processing (Gaussian Mixture Models) to analyze energy levels, spectral characteristics, zero-crossing rates, and pitch.

**Browser availability:** Embedded in WebRTC implementations in Chrome, Firefox, and Safari, but **not directly exposed as a standalone API**. The VAD operates internally for features like automatic gain control and noise suppression.

**Accessing it in browser:**
- No direct JavaScript API for the raw VAD decisions
- Can be accessed via WebRTC audio tracks' built-in processing
- Alternative: Use `libfvad-wasm` (WebRTC VAD compiled to WASM) for standalone use

**Performance:**
- Lightweight (few KB)
- Processes in real-time
- Lower accuracy than Silero VAD (4x more errors at same FPR)
- Struggles with diverse speech patterns and noisy environments

**When to use:** If bundle size is absolutely critical and accuracy requirements are relaxed. Not recommended for medical use.

**Confidence:** HIGH

---

### 1.5 Hark.js

**What it is:** A tiny browser module that listens to an audio stream and emits `speaking` and `stopped_speaking` events using WebAudio API FFT analysis.

**Status:** Package is available on npm (`hark`) but has seen minimal maintenance. Last substantive update was several years ago. Weekly downloads remain moderate due to legacy usage in WebRTC libraries.

**How it works:**
- Takes a MediaStream as input
- Uses WebAudio AnalyserNode to compute frequency power
- Emits events when power exceeds/falls below a configurable threshold
- Similar to energy-based VAD but uses FFT power spectrum

**Pros:**
- Very small (~3 KB)
- Simple event-based API
- No external dependencies

**Cons:**
- Energy/FFT-based -- same accuracy limitations as energy VAD
- Maintenance status is concerning for production use
- No deep learning model -- cannot distinguish speech from other sounds
- Limited configuration options

**Assessment:** Largely superseded by `@ricky0123/vad-web`. Not recommended for new projects.

**Confidence:** HIGH

---

### 1.6 OpenAI Realtime API VAD (Server-Side)

**What it is:** Built-in server-side VAD in OpenAI's Realtime API. The server processes the audio stream and determines speech boundaries.

**Two modes:**

**a) Server VAD (`server_vad`):**
- Default mode for Realtime sessions
- Uses silence-based chunking
- Configurable parameters:
  - `threshold` (0-1, default 0.5): Activation sensitivity
  - `prefix_padding_ms` (default 300ms): Audio to include before speech detection
  - `silence_duration_ms` (default 500ms): Silence duration to detect end of speech
- Emits events: `input_audio_buffer.speech_started`, `input_audio_buffer.speech_stopped`
- Supports `idle_timeout_ms` for inactivity detection

**b) Semantic VAD (`semantic_vad`):**
- Uses a semantic classifier that evaluates whether the user has finished their utterance based on the *words spoken*, not just silence
- Scores input audio based on the probability that the user is done speaking
- `eagerness` parameter: "low", "medium", "high", or "auto" (default = "auto" = "medium")
- For medical context, **"low" eagerness is strongly recommended** -- waits longer for patients to finish their thought

**Interruption handling:**
- `interrupt_response`: Whether user speech interrupts AI response (barge-in)
- `create_response`: Whether to auto-create a response after turn detection

**Advantages for our use case:**
- Semantic understanding of turn completion (not just silence)
- No client-side model download needed
- Server handles all VAD complexity
- "Low" eagerness mode is ideal for medical conversations with pauses

**Disadvantages:**
- Tied to OpenAI Realtime API (vendor lock-in)
- Requires streaming all audio to OpenAI's servers
- No offline capability
- Cost implications (per-minute pricing)

**Confidence:** HIGH

---

### 1.7 TEN-VAD

**What it is:** A newer (2025) open-source VAD from the TEN Framework, designed for enterprise real-time voice applications.

**Performance:**
- Superior precision compared to both WebRTC VAD and Silero VAD
- ~32% lower real-time factor (RTF) compared to Silero VAD
- Faster speech-to-non-speech transition detection (Silero has several hundred ms delay)
- Configurable hop sizes: 160/256 samples (10/16ms) at 16kHz

**Platform support:** Linux x64, Windows, macOS, Android, iOS, WASM for web

**Status:** Recently open-sourced ONNX model and WASM+JS bindings. Still early in terms of community adoption for browser use.

**Assessment:** Promising but newer and less battle-tested in browser environments compared to Silero VAD via @ricky0123/vad-web. Worth monitoring for future versions.

**Confidence:** MEDIUM (newer technology, less community validation in browser)

---

### 1.8 Picovoice Cobra VAD

**What it is:** Commercial, production-ready lightweight deep learning VAD.

**Performance:** 12x fewer errors than Silero VAD, 50x fewer than WebRTC VAD at 5% FPR. Best-in-class accuracy.

**Browser support:** Chrome, Firefox, Safari, Edge via Web SDK.

**Pricing:** Free tier available (unlimited voice interactions), paid tiers for scale. Requires API key.

**Assessment:** Best accuracy but introduces a commercial dependency. Consider for production if budget allows and open-source alternatives prove insufficient.

**Confidence:** HIGH

---

### Comparison Table

| Library | Accuracy | Bundle Size | Browser Support | Configurable | Latency | Cost | Recommendation |
|---------|----------|-------------|-----------------|--------------|---------|------|----------------|
| @ricky0123/vad-web (Silero) | High (87.7% TPR@5% FPR) | ~7-10 MB (ONNX+WASM) | Chrome, FF, Safari, Edge | High | Low (~189us/chunk) | Free/MIT | **PRIMARY for client-side** |
| Silero VAD (direct) | Same as above | ~2 MB model + ~5-8 MB WASM | Same | Full control | Low | Free/MIT | Only if wrapper insufficient |
| Energy-based | Low | ~0 KB | Universal | Minimal | Negligible | Free | Fallback only |
| WebRTC built-in | Moderate | ~0 KB (built-in) | Native in browsers | Limited | Low | Free | Not for medical use |
| Hark.js | Low-Moderate | ~3 KB | Good | Limited | Low | Free | Superseded |
| OpenAI Realtime API | Very High (semantic) | 0 KB (server-side) | N/A (server) | Medium | Network-dependent | Per-minute | **BEST if using Realtime API** |
| TEN-VAD | High (better than Silero) | TBD (WASM new) | Emerging | High | Very Low | Free | Monitor for future |
| Picovoice Cobra | Highest (12x better than Silero) | ~2-3 MB | Chrome, FF, Safari, Edge | Medium | Low | Free tier / Paid | Consider for production |

---

## 2. Turn Detection Strategies

### 2.1 Simple Silence Threshold

The most basic approach: declare end-of-turn after X milliseconds of continuous silence.

**Typical values:**
| Context | Threshold | Rationale |
|---------|-----------|-----------|
| Casual conversation | 500-700ms | Natural human gap is ~200-600ms |
| Customer service | 800-1000ms | Allows thinking time |
| Medical anamnesis | 1200-1500ms | Patients pause to recall symptoms, compose thoughts |
| Therapeutic/counseling | 1500-2500ms | Long pauses are meaningful |

**For our medical triage:** Start at **1200ms** and allow patients to adjust if needed. This is significantly longer than OpenAI's default of 500ms, reflecting the medical context.

**Pros:**
- Simple to implement and understand
- Predictable behavior
- Easy to explain to users ("wait a moment after speaking")

**Cons:**
- Fixed threshold cannot adapt to individual speech patterns
- Too short: cuts off patients mid-thought
- Too long: makes the AI feel unresponsive
- Cannot distinguish "thinking pause" from "done speaking"

**Confidence:** HIGH

---

### 2.2 Adaptive Threshold

Dynamically adjust the silence threshold based on observed speech patterns during the conversation.

**Approach:**
```
baseThreshold = 1200ms
if (patient speaks in short bursts with long pauses) -> increase threshold to 1800ms
if (patient speaks fluently with minimal pauses) -> decrease threshold to 900ms
```

**Implementation strategies:**
1. **Rolling average:** Track average pause duration within speech segments. If a patient's intra-sentence pauses average 800ms, set end-of-turn threshold to 2x that (~1600ms)
2. **Hesitancy detection:** If speech contains many filler words ("eh", "hm", "tipo"), increase threshold
3. **Speech rate tracking:** Slower speech rate correlates with longer natural pauses

**Complexity:** Medium-high. Requires tracking per-session statistics and updating parameters in real-time.

**Recommendation:** Implement as a Phase 2 enhancement after basic silence threshold is working. For MVP, use a fixed generous threshold.

**Confidence:** MEDIUM (effective in theory, needs tuning with real users)

---

### 2.3 Hybrid Approach: VAD + Silence + Semantic Cues

Combine multiple signals for more accurate turn detection:

1. **VAD signal:** Is the patient currently producing speech sounds?
2. **Silence duration:** How long since the last speech frame?
3. **Semantic analysis:** Does the transcript so far form a complete thought?
4. **Prosodic cues:** Did intonation fall (declarative) or rise (question)?

**How OpenAI Semantic VAD implements this:**
The semantic_vad mode scores input audio based on the probability that the user is done speaking. It combines acoustic signals with language model understanding of sentence completeness. The `eagerness` parameter controls how aggressively it interrupts:
- `"low"`: Waits longer, tolerates more pauses -- **ideal for medical**
- `"medium"`: Balanced (default)
- `"high"`: Responds quickly, may cut off hesitant speakers

**Custom hybrid implementation (if not using OpenAI Realtime):**
```
endOfTurnScore = 0
if (silenceDuration > 800ms) endOfTurnScore += 0.3
if (silenceDuration > 1200ms) endOfTurnScore += 0.3
if (lastTranscriptEndsWithPunctuation) endOfTurnScore += 0.2
if (vadProbability < 0.1 for 500ms) endOfTurnScore += 0.2
if (endOfTurnScore >= 0.7) -> trigger response
```

**Confidence:** HIGH (industry best practice)

---

### 2.4 Server-Side vs Client-Side Turn Detection

| Aspect | Client-Side | Server-Side |
|--------|-------------|-------------|
| Latency | Lower (no network round-trip) | Higher (depends on connection) |
| Accuracy | Good (Silero VAD) | Best (semantic analysis possible) |
| Complexity | Moderate | Lower (API handles it) |
| Offline capability | Yes | No |
| Audio data exposure | Audio stays on device until needed | All audio streamed to server |
| Cost | Free (open-source models) | Per-minute API pricing |
| Adaptability | Limited (fixed models) | High (server can use LLM) |

**Recommendation for our stack:**
- **If using OpenAI Realtime API:** Use server-side semantic_vad (eagerness: "low"). The API handles turn detection natively.
- **If using separate STT/TTS:** Use client-side @ricky0123/vad-web for initial speech detection, then send completed audio segments to STT service.

**Confidence:** HIGH

---

### 2.5 Handling Pauses in Medical Conversations

Medical patients pause for many reasons that are NOT end-of-turn:
- **Remembering:** "I started feeling pain in my... (pause)... my chest, about two weeks ago"
- **Emotional distress:** Patient may cry, compose themselves, then continue
- **Thinking:** "The medicine I take is called... (long pause)... Losartan"
- **Physical discomfort:** Coughing, shifting position, catching breath
- **Complex descriptions:** Trying to describe unfamiliar symptoms

**Strategies for handling:**

1. **Generous default silence threshold:** 1200-1500ms minimum
2. **Visual "still listening" indicator:** Show that the system is waiting patiently
3. **Soft prompt after extended silence (5-8s):** "Posso continuar ouvindo, sem pressa." (I can keep listening, no rush.)
4. **Never auto-submit on very short utterances:** Require `minSpeechFrames` to be high enough to ignore sighs and short sounds
5. **"Continue" gesture:** Let patient tap a button to signal they need more time
6. **Context-aware patience:** After asking emotionally charged questions (about pain, family history), increase the threshold automatically

**Confidence:** HIGH (well-established in therapeutic/clinical UX research)

---

### 2.6 Interruption Handling (Barge-In)

When the patient starts speaking while the AI agent's TTS is playing:

**Strategy A -- Immediate Barge-In (Recommended):**
1. VAD detects speech while TTS is playing
2. Immediately stop TTS playback
3. Clear any remaining TTS audio buffer
4. Switch to listening mode
5. Process patient's speech normally

**Implementation requirements:**
- VAD must run continuously, even during TTS playback
- Need echo cancellation to avoid VAD triggering on TTS audio
- TTS stop must happen within 200ms of detecting barge-in
- Brief visual transition to indicate mode switch

**Strategy B -- Queue (Not Recommended for Medical):**
Buffer patient speech and process after TTS finishes. This feels unnatural and may frustrate patients who are trying to correct or add information.

**Strategy C -- Hybrid (Consider for MVP+):**
- Short TTS responses: use immediate barge-in
- Long TTS responses: add visual "breathing spaces" (brief pauses) where barge-in is most expected
- If barge-in detected, stop TTS but add a 300ms buffer before processing to ensure VAD is correct (avoid triggering on coughs/noise)

**Echo cancellation considerations:**
When TTS audio plays through speakers and the microphone picks it up, the VAD may falsely detect "speech." Solutions:
- Use hardware echo cancellation (available via WebRTC `echoCancellation: true` in `getUserMedia` constraints)
- Mute VAD during TTS playback and use push-to-interrupt button as fallback
- Use headphones (recommended for best experience)

**Confidence:** HIGH

---

## 3. Voice UI State Machine

### 3.1 States

```
CONNECTING  -->  IDLE  -->  LISTENING  -->  PROCESSING  -->  SPEAKING
                  ^            |                              |
                  |            v                              v
                  +-------  PAUSED  <-------------------------+
                  |
                  v
                ERROR
```

| State | Description | User sees | System behavior |
|-------|-------------|-----------|-----------------|
| `CONNECTING` | Establishing audio pipeline | "Conectando..." spinner | Initialize AudioContext, request mic permission, load VAD model |
| `IDLE` | Ready but not yet started | "Toque para iniciar" button | Mic acquired, VAD loaded, waiting for user action |
| `LISTENING` | Actively listening for patient speech | Pulsing orb, "Ouvindo..." label | VAD active, recording audio, real-time transcription |
| `PROCESSING` | Patient finished speaking, waiting for AI response | Thinking animation, "Processando..." | Audio sent to STT, transcript sent to LLM, waiting for response |
| `SPEAKING` | AI agent is speaking (TTS playing) | Speaking animation, response text displayed | TTS audio playing, VAD monitoring for barge-in |
| `PAUSED` | Conversation paused by user | "Pausado" with resume button | Mic muted, timers paused, state preserved |
| `ERROR` | Something went wrong | Error message with retry options | Mic lost, network down, or API error |

### 3.2 Transitions

| From | To | Trigger | Action |
|------|----|---------|--------|
| `CONNECTING` | `IDLE` | AudioContext + mic + VAD ready | Show welcome message |
| `CONNECTING` | `ERROR` | Mic denied or VAD load failure | Show specific error message |
| `IDLE` | `LISTENING` | User taps "Iniciar Triagem" | Start VAD, begin recording |
| `LISTENING` | `LISTENING` | VAD detects ongoing speech | Update waveform, accumulate transcript |
| `LISTENING` | `PROCESSING` | Silence threshold exceeded | Send audio segment to STT/LLM |
| `LISTENING` | `PAUSED` | User taps pause button | Mute mic, pause timer |
| `LISTENING` | `ERROR` | Mic disconnected | Show reconnect prompt |
| `PROCESSING` | `SPEAKING` | AI response ready + TTS audio received | Begin TTS playback |
| `PROCESSING` | `ERROR` | API timeout/failure | Show retry option |
| `SPEAKING` | `LISTENING` | TTS playback complete | Resume VAD monitoring |
| `SPEAKING` | `LISTENING` | Barge-in detected (patient interrupts) | Stop TTS, switch to listening |
| `SPEAKING` | `PAUSED` | User taps pause during AI speech | Stop TTS, pause timer |
| `PAUSED` | `LISTENING` | User taps resume | Resume VAD monitoring |
| `ERROR` | `CONNECTING` | User taps retry | Re-initialize audio pipeline |
| `ERROR` | `IDLE` | Partial recovery (e.g., mic reconnected) | Return to ready state |
| Any | `ERROR` | Network disconnect during any active state | Save state, show reconnect |

### 3.3 Edge Cases

1. **Network drop during SPEAKING:** Stop TTS, save conversation state to local storage, show reconnect UI. When reconnected, offer to replay the last AI response.

2. **Mic disconnect during LISTENING:** Immediately transition to ERROR. Show "Microfone desconectado" message with instructions to reconnect. Do NOT lose any already-captured audio.

3. **Browser tab backgrounded during LISTENING:** On mobile, audio capture may stop. Show a warning banner when tab regains focus: "A gravacao pode ter sido interrompida. Deseja continuar?"

4. **User closes browser during conversation:** Save conversation state (current question, transcript so far) to Supabase. Allow resumption on next visit.

5. **Very long silence (>30s) during LISTENING:** Show gentle prompt: "Ainda estou aqui. Pode continuar quando estiver pronto." Do NOT auto-end the session.

6. **Rapid state flapping (LISTENING <-> PROCESSING):** If VAD triggers end-of-speech but patient immediately resumes, cancel the PROCESSING transition and stay in LISTENING. Use `redemptionFrames` in VAD config to handle this.

### 3.4 State Persistence

- **Within session:** Use React state (Context or Zustand) for real-time state management
- **Across page navigation:** NOT recommended for voice state -- the audio pipeline should be torn down and re-established if the user navigates away from the triage page
- **Session recovery:** Store conversation transcript and current question index in Supabase. If user returns, offer to resume from where they left off (not the audio state, but the conversation position)

**Confidence:** HIGH

---

## 4. Visual Feedback Patterns

### 4.1 Listening Indicator

**Recommended: Pulsing Orb**
A circular element that gently pulses, with amplitude responsive to the patient's voice volume.

**Implementation options:**
| Approach | Complexity | Performance | Visual Quality |
|----------|-----------|-------------|----------------|
| CSS `animate-pulse` (Tailwind) | Low | Excellent | Basic but clean |
| CSS custom keyframes with `scale` + `box-shadow` | Low-Medium | Excellent | Good, customizable |
| Canvas/WebGL audio-reactive orb | High | Good (GPU) | Impressive, fluid |
| Lottie animation | Medium | Good | Professional, designer-friendly |

**CSS implementation (Tailwind-compatible):**
```css
@keyframes listening-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(var(--color-primary), 0.4); }
  50% { transform: scale(1.05); box-shadow: 0 0 20px 10px rgba(var(--color-primary), 0.2); }
}
```

**Audio-reactive variant:** Use Web Audio API `AnalyserNode` to get real-time volume levels, then map to the orb's scale and glow intensity. This creates a "breathing" effect synchronized with the patient's speech.

**Reference implementations:**
- Google Assistant: colored dots that dance with voice
- ChatGPT Voice: glowing circular waveform
- Siri: multi-colored orb with fluid motion
- Alexa: blue ring pulse

### 4.2 Processing Indicator

**Recommended: Gentle wave animation**
Three or four dots that gently oscillate, similar to a typing indicator. Alternatively, the orb can smoothly transition from "listening pulse" to a slower "thinking breathe" animation.

```css
@keyframes thinking-breathe {
  0%, 100% { transform: scale(0.95); opacity: 0.7; }
  50% { transform: scale(1.02); opacity: 1; }
}
```

### 4.3 Speaking Indicator

**Recommended: Audio waveform visualization**
Show subtle waveform bars or a gently animated orb while the AI speaks. The animation should be tied to the TTS audio's actual amplitude.

**Implementation:** Connect TTS audio output to a Web Audio `AnalyserNode`, extract frequency data, and render as animated bars or orb distortion.

### 4.4 Idle State

**Recommended: Static orb with subtle ambient animation**
The orb sits calmly with a very slow, gentle glow cycle (period ~4s). Accompanied by a prompt: "Toque para iniciar sua triagem" (Tap to start your triage).

### 4.5 Design System Integration

Using the project's existing Tailwind theme tokens:
- **Listening:** `--color-primary` glow
- **Processing:** `--color-primary` at reduced opacity with slower animation
- **Speaking:** `--color-primary` with waveform accent
- **Error:** `--color-urgency-emergency` (red tones)
- **Idle:** `--color-surface-secondary` with subtle `--color-primary` accent

**Confidence:** HIGH

---

## 5. AI Agent Avatar/Visual Representation

### 5.1 Options Analysis

| Approach | Effort | Quality | Performance | a11y | Recommendation |
|----------|--------|---------|-------------|------|----------------|
| **CSS/Tailwind animated orb** | Low | Good | Excellent | Easy | **MVP choice** |
| **Lottie animations** | Medium | Professional | Good | Moderate | Good alternative |
| **Canvas 2D waveform** | Medium | Good | Good | Moderate | For audio visualization |
| **React Three Fiber (3D)** | Very High | Impressive | Variable | Hard | Overkill for MVP |
| **SVG animated icons** | Low | Clean | Excellent | Easy | Minimalist option |

### 5.2 Recommended MVP Approach: CSS Animated Orb

A circular div with Tailwind utility classes and custom CSS animations, transitioning between states. This approach:
- Uses zero external dependencies
- Leverages the existing Tailwind theme
- Performs excellently on all devices
- Is trivially accessible (just decorative, with proper ARIA)
- Can be enhanced later with audio-reactive behavior

**Conceptual structure:**
```tsx
<div className="relative flex items-center justify-center">
  {/* Outer glow ring */}
  <div className={cn(
    "absolute rounded-full transition-all duration-500",
    state === "listening" && "animate-listening-pulse bg-primary/20 w-32 h-32",
    state === "processing" && "animate-thinking-breathe bg-primary/10 w-28 h-28",
    state === "speaking" && "animate-speaking-wave bg-primary/15 w-30 h-30",
  )} />
  {/* Inner orb */}
  <div className={cn(
    "rounded-full w-20 h-20 flex items-center justify-center",
    "bg-gradient-to-br from-primary to-primary/80",
    "shadow-lg transition-all duration-300"
  )}>
    <MicrophoneIcon /> {/* or WaveformIcon depending on state */}
  </div>
</div>
```

### 5.3 Audio-Reactive Enhancement (Post-MVP)

Use `useAudioLevel` pattern to connect microphone input to animation parameters:
1. Create `AnalyserNode` from the mic stream
2. Sample frequency data at ~30fps
3. Compute average amplitude
4. Map amplitude to CSS custom properties (`--voice-intensity`)
5. Use `--voice-intensity` in animation `scale` and `box-shadow`

**Libraries for this:**
- `react-voice-visualizer`: Full audio recording + visualization
- `ta-react-voice-orb`: AI voice orb animation component
- Custom implementation: ~50 lines with Web Audio API

### 5.4 Accessibility Requirements

- The orb is **decorative** -- it must not convey information that is not also available in text
- All state changes must be announced via `aria-live` region (text-based)
- `prefers-reduced-motion: reduce` must replace all animations with static indicators
- Color alone must not indicate state -- use icons and text labels alongside

**Confidence:** HIGH

---

## 6. Triage Screen Layout

### 6.1 Recommended Layout: Full-Screen Immersive with Transcript

```
+--------------------------------------------------+
| PatientHeader (nome, sair)          [Emergencia!] |
+--------------------------------------------------+
|                                                    |
|  +--------------------------------------------+   |
|  |        Transcricao em tempo real            |   |
|  |                                             |   |
|  |  Agente: Como voce esta se sentindo hoje?   |   |
|  |  Voce: Estou com uma dor de cabeca forte... |   |
|  |  Agente: Ha quanto tempo sente essa dor?    |   |
|  |  Voce: Comecou ontem a noite...             |   |
|  |  [digitando...]                             |   |
|  +--------------------------------------------+   |
|                                                    |
|              +------------------+                  |
|              |                  |                  |
|              |   [ORB/AVATAR]   |                  |
|              |   Estado: Ouvindo|                  |
|              |                  |                  |
|              +------------------+                  |
|                                                    |
|    [Pausar]        00:03:45        [Encerrar]      |
|                                                    |
+--------------------------------------------------+
```

### 6.2 Layout Components

1. **PatientHeader (existing):** Keep minimal -- patient name and logout. Add emergency button in top-right corner.

2. **Transcript Panel (top/center):**
   - Chat-like scrolling transcript
   - Different styling for patient vs agent messages
   - Real-time "typing" indicator while STT processes
   - Auto-scroll to latest message
   - Scrollable for review but auto-anchored to bottom

3. **Avatar/Orb (center):**
   - The animated orb described in Section 5
   - Below the transcript on mobile, to the side on desktop
   - State label beneath: "Ouvindo...", "Processando...", "Falando..."

4. **Control Bar (bottom):**
   - Pause/Resume button (left)
   - Timer showing consultation duration (center)
   - End consultation button (right) -- requires confirmation dialog
   - Microphone mute toggle (optional, near pause)

5. **Emergency Stop Button:**
   - Fixed position, always visible, high contrast
   - Red, labeled "Emergencia!" or "Parar"
   - One-tap access to emergency instructions or phone number
   - Must be reachable without scrolling on any screen size

### 6.3 Mobile-First Considerations

- **Portrait orientation:** Transcript on top (40%), orb in middle (30%), controls at bottom (30%)
- **Keyboard avoidance:** No text input on triage screen (voice only), so no keyboard conflict
- **Thumb reach:** Controls at bottom of screen for easy thumb access
- **Full-screen mode:** Consider using Fullscreen API to minimize distractions
- **Screen awake:** Use `navigator.wakeLock.request('screen')` to prevent screen from sleeping during triage
- **Safe area insets:** Account for notches and bottom bars with `env(safe-area-inset-*)` in CSS

### 6.4 Desktop Layout Variant

On wider screens (>768px), use a side-by-side layout:
- Left panel (60%): Transcript
- Right panel (40%): Orb, state indicator, controls
- This gives more transcript space while keeping the voice controls prominent

### 6.5 Reference Designs

- **Google Duplex/Assistant:** Full-screen with central animated element
- **ChatGPT Voice Mode:** Dark background, glowing orb center, minimal UI
- **Babylon Health / Ada Health:** Card-based with clear state indicators
- **Telehealth platforms (Doxy.me, Teladoc):** Video-centric but voice controls at bottom

**Confidence:** HIGH

---

## 7. Accessibility (a11y)

### 7.1 Screen Reader Compatibility

**Challenge:** Voice interfaces can conflict with screen readers (JAWS, NVDA, VoiceOver) because both use audio output. A blind user may have VoiceOver reading the screen while the TTS agent also speaks.

**Solutions:**
1. **Separate audio channels:** Use different audio outputs if possible (speakers for TTS, headphones for screen reader) -- this is user-configured and cannot be controlled programmatically
2. **Pause screen reader during AI speech:** Not technically possible; instead, ensure transcript text is available so screen reader can read it at the user's pace
3. **Text-based fallback mode:** Offer a text chat alternative for users who cannot use voice. This is essential for deaf/hard-of-hearing users as well
4. **Sequential announcements:** Use `aria-live="polite"` so screen reader announcements queue after the current speech, rather than interrupting

### 7.2 ARIA Implementation

```html
<!-- State announcements -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
  {stateAnnouncement}
  <!-- e.g., "O agente esta ouvindo. Fale quando estiver pronto." -->
</div>

<!-- Transcript region -->
<div role="log" aria-label="Transcricao da consulta" aria-live="polite">
  {messages.map(msg => (
    <p aria-label={msg.role === 'agent' ? 'Agente disse' : 'Voce disse'}>
      {msg.text}
    </p>
  ))}
</div>

<!-- Orb (decorative) -->
<div role="presentation" aria-hidden="true">
  <Orb state={currentState} />
</div>

<!-- State label (visible + accessible) -->
<p role="status" aria-live="polite">
  {stateLabel} {/* "Ouvindo...", "Processando...", etc. */}
</p>
```

### 7.3 Keyboard Navigation

| Key | Action |
|-----|--------|
| `Space` / `Enter` | Start/pause triage (toggle) |
| `Escape` | Pause conversation |
| `Ctrl + E` | Emergency stop |
| `Tab` | Navigate between controls |
| `Ctrl + M` | Mute/unmute microphone |

All interactive elements must have visible focus indicators (`focus-visible` ring).

### 7.4 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .animate-listening-pulse,
  .animate-thinking-breathe,
  .animate-speaking-wave {
    animation: none !important;
    transition: none !important;
  }

  /* Static alternatives */
  .orb-listening { border: 3px solid var(--color-primary); }
  .orb-processing { border: 3px dashed var(--color-primary); opacity: 0.7; }
  .orb-speaking { border: 3px solid var(--color-primary); background: var(--color-primary-light); }
}
```

### 7.5 Visual Alternatives for Audio Content

- **Real-time transcription** is mandatory -- not optional. All speech (patient and agent) must be displayed as text
- **Captions/subtitles** for AI speech should appear in sync with TTS playback
- **Post-consultation summary** available as downloadable text

### 7.6 High Contrast Mode

```css
@media (prefers-contrast: high) {
  .orb { border: 2px solid currentColor; }
  .state-label { font-weight: bold; text-decoration: underline; }
}
```

### 7.7 Focus Management

- When transitioning to LISTENING state, move focus to the transcript region so screen reader users know something is happening
- When AI finishes speaking, move focus to the latest agent message in the transcript
- When an error occurs, move focus to the error message and retry button
- Use `tabindex="-1"` on programmatically focused elements to avoid disrupting normal tab order

**Confidence:** HIGH (core patterns), MEDIUM (screen reader + voice interface interaction -- inherently challenging)

---

## 8. Mobile Browser Constraints

### 8.1 iOS Safari

**getUserMedia:**
- Requires HTTPS (all modern browsers do)
- Permission prompt appears each time for new origins; less persistent than Chrome
- Works in standalone PWA mode since iOS 14.3+
- Camera/mic access revoked when app goes to background

**AudioContext autoplay policy:**
- AudioContext is suspended by default until a user gesture
- **Workaround:** Create AudioContext inside a `click` or `touchstart` event handler
- Exception: If page is already capturing audio via getUserMedia, AudioContext is allowed
- Must call `audioContext.resume()` after user interaction

**Audio output behavior:**
- getUserMedia forces audio output to speakers (not earpiece) on iOS -- this is a known issue
- Bluetooth headphones work but may introduce latency

**Background behavior:**
- Audio capture STOPS when Safari goes to background or screen locks
- No workaround -- this is an OS-level restriction
- Must warn users to keep the app in foreground

**Recommendation:** Gate ALL audio initialization behind a prominent "Iniciar Triagem" button. This satisfies autoplay policies and gives clear user consent.

### 8.2 Android Chrome

**getUserMedia:**
- Requires HTTPS
- Permission persists per origin (more persistent than Safari)
- Works in background tabs with some restrictions

**Background behavior:**
- Recording continues briefly when switching tabs but may be terminated by the browser
- Allowed sites can record only when the user is on the site
- If using a different tab or app, recording may stop

**WebView considerations:**
- getUserMedia in WebView requires explicit app-level permissions
- May silently fail if not properly configured

### 8.3 PWA Considerations

**Audio capture in PWA:**
- PWAs can use getUserMedia for microphone access
- Works in standalone mode on both iOS and Android
- Service workers cannot directly access MediaStream
- Audio processing must happen in the main thread or AudioWorklet

**Background limitations:**
- Service workers have idle timeouts (browsers terminate inactive workers)
- No background audio capture when PWA is not in foreground
- Cannot maintain persistent audio connections in background

**Screen Wake Lock API:**
```typescript
// Prevent screen from sleeping during triage
let wakeLock: WakeLockSentinel | null = null

async function keepScreenAwake() {
  try {
    wakeLock = await navigator.wakeLock.request('screen')
  } catch (err) {
    // Wake Lock not supported or permission denied
    console.warn('Wake Lock not available:', err)
  }
}

// Release when triage ends
async function releaseWakeLock() {
  if (wakeLock) {
    await wakeLock.release()
    wakeLock = null
  }
}
```

**Browser support for Wake Lock:** Chrome 84+, Edge 84+, Safari 16.4+, Firefox (not yet)

### 8.4 Screen Lock / Sleep

| Platform | Behavior | Mitigation |
|----------|----------|------------|
| iOS Safari | Audio capture stops on screen lock | Use Wake Lock API; warn user |
| iOS PWA | Same as Safari | Same |
| Android Chrome | Audio capture stops on screen lock | Use Wake Lock API |
| Android PWA | Same as Chrome | Same |

**Critical UX pattern:** Display a warning at the start of triage:
> "Mantenha a tela ligada durante a triagem. Nao bloqueie o telefone."
> (Keep the screen on during triage. Do not lock your phone.)

### 8.5 Battery and Performance

**Audio processing impact:**
- Continuous microphone capture: Low power usage (~1-2% battery/hour)
- VAD (Silero ONNX in WASM): Moderate CPU usage, ~5-10% on modern phones
- TTS playback: Minimal additional power
- Overall: A 15-minute triage session should consume ~2-3% battery on a modern phone

**Performance optimization:**
- Use AudioWorklet for VAD processing (off main thread)
- Limit AnalyserNode updates to ~15-20 fps for visual feedback (not 60fps)
- Lazy-load ONNX model only when triage is initiated
- Use `requestAnimationFrame` for visual updates, not `setInterval`

**Confidence:** HIGH (iOS Safari constraints), MEDIUM (exact battery figures vary by device)

---

## Recommendations

### For MVP Implementation

1. **VAD Library:** Use `@ricky0123/vad-web` with Silero v5 model for client-side VAD. If the team decides on OpenAI Realtime API (per Researcher B), use its built-in `semantic_vad` with `eagerness: "low"` instead -- this is the superior option for medical conversations.

2. **Turn Detection:** Start with a fixed 1200ms silence threshold. If using OpenAI Realtime API, use semantic_vad with "low" eagerness. Implement adaptive thresholds as a post-MVP enhancement.

3. **Barge-In:** Implement immediate barge-in (stop TTS when patient speaks). Use `echoCancellation: true` in getUserMedia constraints.

4. **Visual Representation:** CSS/Tailwind animated orb with three state animations (listening pulse, processing breathe, speaking wave). No external animation library needed for MVP.

5. **Layout:** Full-screen immersive layout with transcript panel (top), orb (center), and control bar (bottom). Mobile-first, responsive to desktop with side-by-side variant.

6. **Accessibility:** ARIA live regions for all state changes, `prefers-reduced-motion` support, real-time transcription as mandatory visual alternative, keyboard shortcuts for all controls, text-based fallback mode.

7. **Mobile:** Gate audio initialization behind user gesture. Use Wake Lock API to prevent screen sleep. Warn users about keeping the app in foreground. Test primarily on iOS Safari and Android Chrome.

### For Post-MVP Enhancement

1. **Adaptive silence threshold** based on patient speech patterns
2. **Audio-reactive orb** using Web Audio AnalyserNode for real-time volume mapping
3. **Emotion-aware patience** -- longer thresholds after emotionally charged questions
4. **TEN-VAD** evaluation as potential Silero replacement (if WASM support matures)
5. **3D avatar** with lip-sync for a more engaging experience (React Three Fiber)

---

## Open Questions

1. **Echo cancellation reliability:** How well does browser-native echo cancellation work when TTS plays through speakers and the microphone is active? May need real-device testing across iOS and Android to validate barge-in reliability.

2. **Silero v5 parameter tuning:** The vad-web docs note that v5 requires different parameter values than legacy. What are the optimal `positiveSpeechThreshold`, `redemptionFrames`, and `negativeSpeechThreshold` values for Portuguese speech in a medical context? Requires empirical testing.

3. **Semantic VAD + custom instructions:** If using OpenAI Realtime API semantic_vad, can we provide context ("this is a medical conversation, be very patient with pauses") to influence turn detection behavior? The API currently only exposes the `eagerness` parameter.

4. **Screen reader + voice interface UX:** What is the actual user experience for a blind patient using VoiceOver while the AI agent speaks via TTS? This needs real user testing with assistive technology users.

5. **Silence threshold by question type:** Should the system automatically increase silence tolerance for open-ended questions ("Descreva a dor") vs simple yes/no questions ("Voce tem alergia?")? This may require integration between the LLM prompt and the VAD configuration.

6. **WebRTC vs Web Audio API for echo cancellation:** getUserMedia `echoCancellation` constraint uses WebRTC's built-in processing. Is this sufficient, or do we need additional client-side echo cancellation logic?

7. **Bluetooth audio latency:** Patients using Bluetooth headphones may experience significant audio latency. How does this affect VAD timing and turn detection thresholds?

8. **LGPD and audio recording:** If we temporarily buffer audio on the client for VAD processing, does this constitute "data processing" under LGPD? The audio never leaves the device in the client-side VAD scenario, but this should be confirmed with legal review.

---

## Sources

### VAD Libraries
- [@ricky0123/vad-web - npm](https://www.npmjs.com/package/@ricky0123/vad-web) - PRIMARY: Package documentation and API - **HIGH confidence**
- [@ricky0123/vad - GitHub](https://github.com/ricky0123/vad) - Source code, issues, documentation - **HIGH confidence**
- [Silero VAD v5 documentation](https://docs.vad.ricky0123.com/user-guide/silero-v5/) - v5 model details and parameter changes - **HIGH confidence**
- [Silero VAD Quality Metrics - GitHub Wiki](https://github.com/snakers4/silero-vad/wiki/Quality-Metrics) - Accuracy benchmarks - **HIGH confidence**
- [Choosing the Best VAD in 2025 - Picovoice](https://picovoice.ai/blog/best-voice-activity-detection-vad-2025/) - Comparative benchmark (note: Picovoice is Cobra vendor) - **MEDIUM confidence** (vendor bias possible)
- [TEN-VAD - GitHub](https://github.com/TEN-framework/ten-vad) - TEN Framework VAD documentation - **MEDIUM confidence**
- [WebRTC VAD - VideoSDK](https://www.videosdk.live/developer-hub/webrtc/webrtc-voice-activity-detection) - WebRTC VAD overview - **HIGH confidence**
- [Hark.js - npm](https://www.npmjs.com/package/hark) - Package status and API - **HIGH confidence**
- [Picovoice Cobra VAD](https://picovoice.ai/platform/cobra/) - Commercial VAD product page - **HIGH confidence**
- [Energy-based VAD - Aalto University](https://wiki.aalto.fi/pages/viewpage.action?pageId=151500905) - Academic reference on energy VAD - **HIGH confidence**

### Turn Detection
- [OpenAI Realtime API VAD Guide](https://platform.openai.com/docs/guides/realtime-vad) - Official VAD documentation - **HIGH confidence**
- [The Complete Guide to AI Turn-Taking 2025 - Tavus](https://www.tavus.io/post/ai-turn-taking) - Turn detection strategies overview - **HIGH confidence**
- [When Silence Speaks - SpringerLink](https://link.springer.com/chapter/10.1007/978-3-032-02548-7_31) - LLM-based EoT in therapeutic voice - **HIGH confidence**
- [Is It My Turn Yet? - Stanford HAI](https://hai.stanford.edu/news/it-my-turn-yet-teaching-voice-assistant-when-speak) - Research on voice assistant turn-taking - **HIGH confidence**
- [Voice AI doesn't need to be faster - Speechmatics](https://www.speechmatics.com/company/articles-and-news/voice-ai-doesnt-need-to-be-faster-it-needs-to-read-the-room) - Adaptive turn detection - **HIGH confidence**
- [The 300ms Rule - AssemblyAI](https://www.assemblyai.com/blog/low-latency-voice-ai) - Latency in voice AI - **HIGH confidence**
- [Engineering Low-Latency Voice Agents - Sierra AI](https://sierra.ai/blog/voice-latency) - Production voice latency engineering - **HIGH confidence**

### Barge-In and Interruptions
- [Real-Time Barge-In AI - Gnani](https://www.gnani.ai/resources/blogs/real-time-barge-in-ai-for-voice-conversations-31347) - Barge-in technology overview - **HIGH confidence**
- [Master Voice Agent Barge-In Detection - SparkCo](https://sparkco.ai/blog/master-voice-agent-barge-in-detection-handling) - Implementation patterns - **HIGH confidence**
- [Optimizing Barge-In Detection 2025 - SparkCo](https://sparkco.ai/blog/optimizing-voice-agent-barge-in-detection-for-2025) - 2025 best practices - **HIGH confidence**
- [Handling Interruptions in Speech-to-Speech - Medium](https://medium.com/@roshini.rafy/handling-interruptions-in-speech-to-speech-services-a-complete-guide-4255c5aa2d84) - Implementation guide - **MEDIUM confidence**

### Voice UI Patterns
- [VUI Design Principles 2025 - Parallel](https://www.parallelhq.com/blog/voice-user-interface-vui-design-principles) - Design principles - **HIGH confidence**
- [Voice UI Design Patterns 2025 - UI Deploy](https://ui-deploy.com/blog/voice-user-interface-design-patterns-complete-vui-development-guide-2025) - Pattern catalog - **HIGH confidence**
- [Conversation Design and Voice UI - Zypsy](https://llms.zypsy.com/conversation-design-voice-ui) - Latency and prototyping - **HIGH confidence**
- [VOICON: Geometric Motion-Based Visual Feedback - ACM](https://dl.acm.org/doi/10.1145/3643834.3660741) - Academic research on VUI feedback - **HIGH confidence**

### Avatar and Animation
- [Building a Voice Reactive Orb in React - Medium](https://medium.com/@therealmilesjackson/building-a-voice-reactive-orb-in-react-audio-visualization-for-voice-assistants-2bee12797b93) - Implementation tutorial - **HIGH confidence**
- [ta-react-voice-orb - GitHub](https://github.com/Moe03/ta-react-voice-orb) - React orb component - **MEDIUM confidence**
- [react-voice-visualizer - GitHub](https://github.com/YZarytskyi/react-voice-visualizer) - Audio visualization library - **HIGH confidence**
- [Lottie with Audio - LottieFiles](https://lottiefiles.com/blog/working-with-lottie-animations/how-to-animate-lottie-in-response-to-audio) - Audio-reactive Lottie - **HIGH confidence**
- [LiveKit Audio Visualization - DeepWiki](https://deepwiki.com/livekit/components-js/5.4-audio-visualization) - BarVisualizer component - **HIGH confidence**
- [Voice Assistant Orb Challenge - UIverse](https://uiverse.io/challenges/voice-assistant-orb) - CSS/Tailwind orb examples - **MEDIUM confidence**

### Accessibility
- [ARIA Live Regions - Sara Soueidan](https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-1/) - ARIA live implementation - **HIGH confidence**
- [Accessible Animations - Pope Tech](https://blog.pope.tech/2025/12/08/design-accessible-animation-and-movement/) - prefers-reduced-motion patterns - **HIGH confidence**
- [Accessible Animations in React - Josh Comeau](https://www.joshwcomeau.com/react/prefers-reduced-motion/) - React implementation - **HIGH confidence**
- [prefers-reduced-motion - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) - API reference - **HIGH confidence**
- [ARIA Labels Implementation Guide 2025 - AllAccessible](https://www.allaccessible.org/blog/implementing-aria-labels-for-web-accessibility) - Implementation guide - **HIGH confidence**

### Mobile Constraints
- [Getting Started with getUserMedia 2025 - AddPipe](https://blog.addpipe.com/getusermedia-getting-started/) - Browser compatibility guide - **HIGH confidence**
- [iOS Safari getUserMedia Issues - Medium](https://medium.com/@python-javascript-php-html-css/ios-safari-forces-audio-output-to-speakers-when-using-getusermedia-2615196be6fe) - iOS-specific issues - **HIGH confidence**
- [Safari Release Notes Dec 2025 - Releasebot](https://releasebot.io/updates/apple/safari) - Latest Safari changes - **HIGH confidence**
- [getUserMedia - MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) - API reference - **HIGH confidence**
- [PWA Audio Recording - What PWA Can Do Today](https://whatpwacando.today/audio-recording/) - PWA audio capabilities - **HIGH confidence**
- [PWA Limitations on iOS - Codewave](https://codewave.com/insights/progressive-web-apps-ios-limitations-status/) - iOS PWA constraints - **HIGH confidence**
- [Use Microphone in Chrome Android - Google](https://support.google.com/chrome/answer/2693767?hl=en&co=GENIE.Platform%3DAndroid) - Android Chrome mic permissions - **HIGH confidence**

### Telehealth Design
- [Healthcare UI Design 2025 - Eleken](https://www.eleken.co/blog-posts/user-interface-design-for-healthcare-applications) - Healthcare UI patterns - **HIGH confidence**
- [Healthcare UI Design Practices - SPsoft](https://spsoft.com/tech-insights/tips-for-healthcare-ui-design/) - Telehealth design tips - **HIGH confidence**
- [LiveKit Agent Starter React - GitHub](https://github.com/livekit-examples/agent-starter-react) - Reference implementation - **HIGH confidence**
