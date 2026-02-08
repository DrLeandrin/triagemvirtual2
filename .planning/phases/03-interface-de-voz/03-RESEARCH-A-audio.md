# Research A: Audio Capture & Real-time Streaming

**Researcher:** Agent A
**Date:** 2026-02-08
**Confidence:** HIGH

---

## Executive Summary

This document presents a comprehensive analysis of browser-based audio capture and real-time streaming technologies for the Triagem Virtual voice triage system. The system requires continuous microphone capture (no push-to-talk), real-time audio streaming to STT services, and playback of TTS responses -- all within a Next.js 16 App Router architecture running on desktop and mobile browsers.

The recommended architecture uses **getUserMedia** for microphone access with audio processing constraints (echo cancellation, noise suppression, auto gain control), an **AudioWorklet** pipeline for real-time audio processing and encoding to **PCM 16-bit at 16kHz**, streamed over **WebSocket** to a backend relay server. For Next.js compatibility, a **custom server or sidecar WebSocket process** is recommended since Next.js Route Handlers do not natively support WebSocket upgrade. The **@ricky0123/vad-react** library (using the Silero VAD ONNX model) provides robust voice activity detection to determine speech boundaries without push-to-talk.

Browser compatibility is strong across modern browsers. Safari (desktop and iOS) requires special attention for AudioContext resume policies and autoplay restrictions. All major desktop and mobile browsers now support AudioWorklet (Safari 14.1+/iOS 14.5+). The critical design decision is whether to use a **composed pipeline** (separate STT + LLM + TTS services connected via WebSocket relay) or a **unified solution** like the OpenAI Realtime API. This research focuses on the audio capture and transport layer -- service selection is covered in Research B.

---

## 1. Audio Capture APIs

### 1.1 getUserMedia (WebRTC)

`navigator.mediaDevices.getUserMedia()` is the entry point for microphone access in all modern browsers. It returns a `MediaStream` containing audio tracks.

**Audio constraints for voice capture:**

```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    channelCount: 1,           // Mono -- required by all STT services
    sampleRate: 16000,         // Preferred for STT (see Section 2)
    echoCancellation: true,    // Critical for speaker-mic feedback prevention
    noiseSuppression: true,    // Reduces ambient noise
    autoGainControl: true,     // Normalizes volume levels
  }
});
```

**Browser support:** Universal across Chrome 53+, Firefox 36+, Safari 11+, Edge 12+. Mobile support is strong on iOS Safari 11+ and Android Chrome.

**Key considerations:**
- The `sampleRate` constraint is a *hint*, not a guarantee. Browsers may capture at their native rate (typically 44.1kHz or 48kHz) and the application must resample if the STT service requires 16kHz.
- On iOS Safari, `getUserMedia` must be called from a user gesture (button tap) context.
- HTTPS is required on all browsers (except localhost).

**Confidence:** HIGH -- based on MDN documentation and addpipe.com testing.

### 1.2 Web Audio API: AudioWorklet vs ScriptProcessorNode

The Web Audio API provides the processing pipeline between the raw `MediaStream` and the encoded output.

#### ScriptProcessorNode (DEPRECATED)

`ScriptProcessorNode` runs audio processing on the **main thread**, causing latency spikes and UI jank. It has been deprecated from the specification and replaced by AudioWorklet. **Do not use for new development.**

**Confidence:** HIGH -- MDN explicitly marks it as deprecated.

#### AudioWorklet (RECOMMENDED)

`AudioWorklet` runs audio processing in a **separate audio rendering thread**, providing:
- Low-latency processing (sub-millisecond per 128-sample frame)
- No main thread blocking
- Communication with the main thread via `MessagePort`
- Deterministic execution timing

**Key characteristics:**
- Audio data arrives in **render quanta** of **128 samples** (frames)
- Each frame contains Float32Array data per channel
- The `process(inputs, outputs, parameters)` method is called synchronously for each quantum
- Returning `true` from `process()` keeps the node alive; `false` allows garbage collection

**Browser support:** Chrome 66+, Firefox 76+, Safari 14.1+, Edge 79+. iOS Safari 14.5+.

**Upcoming improvements (W3C TPAC 2025):**
- Configurable render quantum size (currently fixed at 128 samples)
- `performance.now()` availability in AudioWorklet thread
- Output buffer bypass (already shipped) -- removes one buffer of latency

**Confidence:** HIGH -- based on MDN docs and W3C TPAC 2025 update.

### 1.3 MediaRecorder API

The `MediaRecorder` API records media streams into file-like blobs. It is designed for **recording**, not real-time streaming.

**When to use:** Batch recording scenarios (e.g., "record a voice note"). Not suitable for our continuous streaming use case because:
- Data is delivered in chunks via `ondataavailable` with variable timing
- No frame-level control over encoding
- Cannot easily produce raw PCM output (outputs containerized formats)
- Chunk boundaries do not align with speech boundaries

**Format support by browser:**
| Browser | Supported Formats |
|---------|-------------------|
| Chrome/Edge | `audio/webm;codecs=opus`, `audio/ogg;codecs=opus` |
| Firefox | `audio/ogg;codecs=opus`, `audio/webm;codecs=opus` |
| Safari | `audio/mp4;codecs=aac` (production), `audio/wav` (STP 214+) |

**Use `MediaRecorder.isTypeSupported()` to detect format support at runtime.**

**Confidence:** HIGH -- based on MDN and caniuse.com data.

### 1.4 Comparison and Recommendation

| Criterion | getUserMedia + AudioWorklet | MediaRecorder | WebRTC DataChannel |
|-----------|---------------------------|---------------|-------------------|
| Real-time streaming | Yes (frame-level) | No (chunk-level) | Yes |
| Latency control | Excellent (~2.67ms per quantum at 48kHz) | Poor (hundreds of ms) | Good |
| Format control | Full (raw PCM access) | Limited (browser-chosen) | Full |
| Browser support | All modern | All modern | All modern |
| Complexity | Medium | Low | High |

**Recommendation:** Use **getUserMedia** for microphone access + **AudioWorklet** for real-time audio processing. This gives us frame-level access to raw PCM samples, which we can buffer, resample, and stream with precise control.

---

## 2. Audio Encoding & Formats

### 2.1 Format Comparison

| Format | Type | Compression | Latency | STT Compatibility | Browser Encoding |
|--------|------|-------------|---------|-------------------|------------------|
| PCM 16-bit (Linear16) | Raw | None | Zero | Universal (all STT services) | Native via AudioWorklet |
| Opus | Compressed | Lossy | ~26.5ms algorithmic | Deepgram, Google, some others | WebCodecs (Chrome), WASM libs |
| WebM/Opus | Container + Codec | Lossy | Variable | Deepgram (containerized) | MediaRecorder (Chrome/FF) |
| WAV | Container + PCM | None | Zero | Universal | MediaRecorder (Safari STP) |
| AAC | Compressed | Lossy | Higher | Limited STT support | MediaRecorder (Safari) |

### 2.2 Sample Rate Requirements

STT services have specific sample rate expectations:

| Service | Preferred Sample Rate | Accepted Formats |
|---------|----------------------|------------------|
| Google Speech-to-Text | 16kHz | LINEAR16, FLAC, Opus, OGG_OPUS |
| OpenAI Whisper | 16kHz | Various (resamples internally) |
| OpenAI Realtime API | 24kHz | PCM 16-bit little-endian |
| Deepgram | 16kHz (default) | linear16, opus, ogg-opus, webm |
| Azure Speech | 16kHz | PCM, MP3, OGG/Opus |
| AssemblyAI | 16kHz | PCM, various containers |

**Key insight:** 16kHz mono PCM 16-bit is the "universal format" accepted by virtually all STT services. The OpenAI Realtime API is the exception, requiring 24kHz.

### 2.3 Bit Depth

- **16-bit** is the standard for speech. All STT services expect 16-bit.
- **32-bit float** is the native format of Web Audio API (`Float32Array`). Conversion to 16-bit integer is needed before streaming.
- Conversion is straightforward: `Math.max(-1, Math.min(1, float32Sample)) * 0x7FFF`

### 2.4 Browser Encoding Support

**Native (no library needed):**
- All browsers: Raw PCM via AudioWorklet (Float32 -> Int16 conversion in worklet)
- Chrome/Edge: Opus via WebCodecs `AudioEncoder` API
- Chrome/Edge/Firefox: WebM/Opus and OGG/Opus via `MediaRecorder`

**Via WebAssembly libraries:**
- All browsers: Opus encoding via `opus-recorder` or similar WASM libraries
- All browsers: Custom encoding via any WASM-compiled codec

**Recommendation:** Capture as **raw PCM Float32** in AudioWorklet, convert to **PCM Int16 at 16kHz**, and stream as raw PCM. This avoids codec complexity, works universally, and is accepted by all STT services. If bandwidth is a concern (mobile networks), consider adding Opus encoding via WebCodecs (Chrome) or WASM fallback.

**Confidence:** HIGH -- based on MDN WebCodecs docs, STT service documentation, and opus-recorder GitHub.

---

## 3. Real-time Streaming Architecture

### 3.1 Transport Protocol Comparison

| Protocol | Duplex | Binary Support | Latency | Next.js Compat | Complexity |
|----------|--------|---------------|---------|----------------|------------|
| WebSocket | Full duplex | Yes | Low (~ms) | Requires custom server | Medium |
| Server-Sent Events | Server -> Client only | No (text only) | Low | Native Route Handlers | Low |
| WebRTC DataChannel | Full duplex | Yes | Lowest | Requires signaling server | High |
| HTTP Streaming (fetch) | Half duplex per request | Yes (ReadableStream) | Medium | Native Route Handlers | Low |

**Analysis:**

- **WebSocket** is the best fit for our use case: bidirectional binary streaming of audio data with low latency. The client sends audio chunks; the server sends back TTS audio and text events.
- **SSE** cannot carry binary audio data and is unidirectional -- insufficient for our needs.
- **WebRTC DataChannel** has the lowest latency but adds significant complexity (ICE negotiation, STUN/TURN servers) that is unnecessary for a client-server architecture.
- **HTTP Streaming** could work for the response direction but not for continuous audio upload.

### 3.2 Next.js 16 WebSocket Compatibility

**The core problem:** Next.js Route Handlers (App Router) **do not support WebSocket upgrade requests**. This is a known limitation tracked in [GitHub Discussion #58698](https://github.com/vercel/next.js/discussions/58698). Next.js intercepts all "upgrade" events on the HTTP server and closes connections that match API endpoints.

**Solutions ranked by recommendation:**

#### Option A: Separate WebSocket Server (RECOMMENDED)

Run a standalone Node.js WebSocket server (using the `ws` library) alongside the Next.js dev/production server. In production, use a reverse proxy (nginx, Caddy) to route WebSocket connections to the WS server and HTTP requests to Next.js.

```
Client Browser
  |
  +---> HTTP requests ----> Next.js App (port 3000)
  |
  +---> WebSocket ---------> WS Server  (port 3001)
```

**Pros:** Clean separation, no patching, works on any host.
**Cons:** Additional process to manage, CORS configuration needed.

#### Option B: next-ws Package

The `next-ws` npm package patches Next.js to allow WebSocket handlers in App Router routes via an `UPGRADE` export function. Install with `npm install next-ws ws`.

```typescript
// app/api/ws/route.ts
export function UPGRADE(req: Request, socket: WebSocket) {
  socket.onmessage = (event) => { /* handle audio chunks */ };
}
```

**Pros:** Integrated with Next.js routing, simple API.
**Cons:** Requires patching Next.js internals (fragile across updates), **not compatible with serverless deployment** (Vercel, AWS Lambda).

#### Option C: Custom Next.js Server

Create a `server.ts` that wraps the Next.js request handler and attaches a WebSocket server to the same HTTP server.

**Pros:** Single process.
**Cons:** Disables some Next.js optimizations, more complex setup.

#### Option D: PartyKit (Cloud-based)

PartyKit provides globally distributed, stateful WebSocket servers built on Cloudflare Workers. It integrates with any frontend framework including Next.js.

**Pros:** Zero infrastructure management, global edge deployment, built-in state management.
**Cons:** External dependency, potential vendor lock-in, additional cost, data leaves your control (LGPD concern).

**Recommendation:** **Option A** (separate WebSocket server) for development and self-hosted production. It provides the cleanest architecture with no fragile patches. If deploying to Vercel, consider Option D (PartyKit) or a managed WebSocket service.

**Confidence:** HIGH -- based on Next.js GitHub discussions, next-ws documentation, and Fly.io guide.

### 3.3 Audio Chunking Strategy

The AudioWorklet delivers data in 128-sample frames. For efficient network transmission, frames should be buffered and sent in larger chunks.

**Recommended chunking parameters:**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Chunk duration | 100-250ms | Balances latency vs. overhead. Most STT services process in ~100ms windows. |
| Chunk size at 16kHz/16-bit | 3,200-8,000 bytes | 16000 samples/s * 2 bytes * 0.1-0.25s |
| Overlap | 0ms (for streaming STT) | STT services handle continuity internally; overlap wastes bandwidth |
| Buffer strategy | Ring buffer in AudioWorklet | Pre-allocate to avoid GC in audio thread |

**Calculation for 200ms chunks at 16kHz mono 16-bit:**
- Samples per chunk: 16000 * 0.2 = 3200 samples
- Bytes per chunk: 3200 * 2 = 6400 bytes
- Chunks per second: 5
- Bandwidth: 32 KB/s (256 kbps) -- very manageable even on mobile

**Network overhead:** WebSocket frame headers add ~2-14 bytes per message. At 5 messages/second, overhead is negligible.

### 3.4 Latency Budget

Target: **< 500ms** end-to-end (user speaks -> sees/hears response beginning).

| Stage | Target | Notes |
|-------|--------|-------|
| AudioWorklet capture | ~2.7ms | 128 samples at 48kHz |
| Buffering to chunk | 100-200ms | Configurable trade-off |
| WebSocket transport | 10-50ms | Depends on server proximity |
| STT processing | 100-300ms | Service-dependent (streaming mode) |
| **Total to text** | **~200-550ms** | |
| LLM response (first token) | 200-500ms | Depends on model |
| TTS generation (first audio) | 100-300ms | Streaming TTS |
| Audio playback start | ~10ms | Web Audio API buffer scheduling |
| **Total to first audio** | **~500-1350ms** | |

**Key insight:** The 500ms target is achievable for the *speech-to-text* portion. Full round-trip including LLM + TTS will likely be 800-1500ms. This is acceptable for a medical triage conversation where natural pauses occur.

**Confidence:** MEDIUM -- Latency estimates are based on published service benchmarks, but actual values depend heavily on geographic location, server load, and service choice.

---

## 4. Audio Pipeline Architecture

### 4.1 Client-Side Pipeline

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                  │
│                                                      │
│  getUserMedia() ──> MediaStream                      │
│       │                                              │
│       v                                              │
│  AudioContext                                        │
│       │                                              │
│  MediaStreamSourceNode                               │
│       │                                              │
│       ├──> VAD Analyzer (Silero via @ricky0123/vad)  │
│       │         │                                    │
│       │         ├── onSpeechStart() -> notify UI     │
│       │         └── onSpeechEnd(audio) -> send chunk │
│       │                                              │
│       └──> AudioWorkletNode                          │
│                 │                                    │
│                 │  (AudioWorklet thread)              │
│                 │  ┌──────────────────────┐           │
│                 │  │ PCMProcessorWorklet  │           │
│                 │  │ - Receive 128-frame  │           │
│                 │  │   Float32 quanta     │           │
│                 │  │ - Resample to 16kHz  │           │
│                 │  │ - Convert Float32 -> │           │
│                 │  │   Int16 PCM          │           │
│                 │  │ - Buffer to chunks   │           │
│                 │  │ - Post via MessagePort│          │
│                 │  └──────────────────────┘           │
│                 │                                    │
│                 v                                    │
│           Main Thread                                │
│                 │                                    │
│           WebSocket.send(pcmChunk)                   │
│                                                      │
│  ┌─────────────────────────────────────┐             │
│  │       TTS Audio Playback Queue      │             │
│  │  WebSocket.onmessage(audioChunk)    │             │
│  │       │                             │             │
│  │       v                             │             │
│  │  AudioBuffer queue                  │             │
│  │       │                             │             │
│  │       v                             │             │
│  │  AudioBufferSourceNode              │             │
│  │       │                             │             │
│  │       v                             │             │
│  │  AudioContext.destination (speaker)  │             │
│  └─────────────────────────────────────┘             │
└─────────────────────────────────────────────────────┘
```

### 4.2 Server-Side Pipeline

```
┌──────────────────────────────────────────────────┐
│              WebSocket Server (Node.js)           │
│                                                   │
│  Client WebSocket Connection                      │
│       │                                           │
│       │  (receives PCM audio chunks)              │
│       v                                           │
│  ┌─────────────────────┐                          │
│  │  Audio Router       │                          │
│  │  - Buffer management│                          │
│  │  - Session state    │                          │
│  └────────┬────────────┘                          │
│           │                                       │
│           v                                       │
│  ┌─────────────────────┐                          │
│  │  STT Service        │ (WebSocket to Deepgram/  │
│  │  (streaming)        │  Google/OpenAI)          │
│  └────────┬────────────┘                          │
│           │                                       │
│           │  (transcribed text)                    │
│           v                                       │
│  ┌─────────────────────┐                          │
│  │  LLM Service        │ (OpenAI GPT / Anthropic) │
│  │  (streaming)        │                          │
│  └────────┬────────────┘                          │
│           │                                       │
│           │  (response text chunks)                │
│           v                                       │
│  ┌─────────────────────┐                          │
│  │  TTS Service        │ (ElevenLabs / OpenAI /   │
│  │  (streaming)        │  Azure)                  │
│  └────────┬────────────┘                          │
│           │                                       │
│           │  (audio chunks)                        │
│           v                                       │
│  Client WebSocket Connection                      │
│  (sends TTS audio + text events)                  │
└──────────────────────────────────────────────────┘
```

### 4.3 Alternative: OpenAI Realtime API as Unified Pipeline

If using the OpenAI Realtime API (covered in detail in Research B), the server-side pipeline simplifies dramatically:

```
Client ──WebSocket──> Relay Server ──WebSocket──> OpenAI Realtime API
                                                   (STT + LLM + TTS)
```

The relay server exists only to protect the API key and add session management. All audio processing (STT, response generation, TTS) happens within the Realtime API.

**Trade-off:** Simpler architecture vs. vendor lock-in and potentially higher cost.

### 4.4 Edge Function vs. Server-Side Processing

| Approach | Pros | Cons |
|----------|------|------|
| **Edge Function** (Vercel/Cloudflare) | Low latency (edge proximity), auto-scaling | No WebSocket support (serverless), cold starts, execution time limits (typically 30s-5min) |
| **Long-running server** (Node.js) | Full WebSocket support, no time limits, stateful sessions | Requires server management, scaling complexity |
| **Supabase Edge Functions** | Integrated with our stack | Deno-based, limited WebSocket support, execution time limits |

**Recommendation:** Use a **long-running Node.js server** for the WebSocket relay. Edge functions are unsuitable for persistent WebSocket connections and long-running audio sessions (a triage consultation may last 10-30 minutes).

**Confidence:** HIGH.

### 4.5 Memory Management for Long Conversations

A 30-minute triage session generates significant audio data:
- At 16kHz/16-bit mono: 30 min * 60 s * 16000 samples * 2 bytes = ~57.6 MB
- This data should NOT be accumulated in memory.

**Best practices:**
1. **Pre-allocate buffers** in the AudioWorklet. Avoid `new Float32Array()` or `new ArrayBuffer()` inside `process()` -- this triggers garbage collection on the audio thread, causing glitches.
2. Use a **ring buffer** pattern: fixed-size buffer that overwrites old data as new data arrives.
3. **Stream, do not accumulate:** Send audio chunks to the server immediately; do not store the entire conversation's audio on the client.
4. On the server, forward audio to the STT service immediately; do not buffer entire utterances.
5. **Call `AudioContext.close()`** when the conversation ends to release resources. Failing to close releases nothing -- `decodeAudioData` buffers persist.
6. **Disconnect all AudioNodes** when pausing or stopping the session.
7. Monitor memory with `performance.memory` (Chrome) or browser DevTools during development.

**Confidence:** HIGH -- based on Web Audio API performance documentation and GitHub issues tracking AudioContext memory leaks.

---

## 5. Browser Compatibility

### 5.1 Feature Support Matrix

| Feature | Chrome 66+ | Firefox 76+ | Safari 14.1+ | Edge 79+ | iOS Safari 14.5+ | Android Chrome |
|---------|-----------|------------|-------------|---------|------------------|---------------|
| getUserMedia | Yes | Yes | Yes | Yes | Yes | Yes |
| AudioWorklet | Yes | Yes | Yes | Yes | Yes | Yes |
| MediaRecorder | Yes | Yes | Yes (limited formats) | Yes | Yes | Yes |
| WebSocket | Yes | Yes | Yes | Yes | Yes | Yes |
| WebCodecs AudioEncoder | Yes | Partial (behind flag) | No | Yes | No | Yes |
| Permissions API | Yes | Yes | Partial | Yes | Partial | Yes |

### 5.2 iOS Safari Constraints (CRITICAL)

iOS Safari has the most restrictive audio policies. These must be handled explicitly:

1. **AudioContext resume policy:** An `AudioContext` created without a user gesture starts in the `suspended` state. It must be resumed inside a user-initiated event handler (click, tap).

```typescript
// Must be called from a click/tap handler
const startButton = document.getElementById('start');
startButton.addEventListener('click', async () => {
  const audioContext = new AudioContext();
  await audioContext.resume(); // Required on iOS Safari
  // Now proceed with getUserMedia and audio pipeline setup
});
```

2. **getUserMedia must follow user gesture:** The microphone permission prompt only appears when `getUserMedia` is called within a user gesture context.

3. **Autoplay restrictions:** Audio playback (for TTS responses) requires a user gesture to initiate. Once the user has interacted with the page (e.g., clicking "Start Triage"), subsequent audio playback is generally allowed.

4. **WebKit-specific quirks:**
   - `devicechange` events may fire spuriously (fixed in 2025 Safari updates)
   - Echo cancellation constraint had bugs (WebKit bug 179411); verify on target iOS versions
   - Sample rate constraint may be ignored; always verify actual sample rate from the track settings

### 5.3 Android Chrome Microphone Behavior

- Microphone access works reliably when the page is served over HTTPS
- Chrome applies `autoGainControl` and `echoCancellation` by default, even if not requested
- Disabling `echoCancellation` via constraints also disables `autoGainControl` (Chromium quirk)
- Background tab behavior: audio capture may be throttled or suspended when the tab is in the background

### 5.4 Permission Handling

**Permission states** (Permissions API):
- `"prompt"` -- User has not been asked yet; calling `getUserMedia` will show the browser prompt
- `"granted"` -- User previously allowed access
- `"denied"` -- User previously denied access; `getUserMedia` will immediately reject

**Best practice:** Check permission state before calling `getUserMedia` to provide appropriate UI guidance:

```typescript
async function checkMicrophonePermission(): Promise<PermissionState> {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return result.state; // 'granted', 'denied', or 'prompt'
  } catch {
    // Permissions API not supported (older Safari); fall back to trying getUserMedia
    return 'prompt';
  }
}
```

**Error differentiation (Chrome):**
- `NotAllowedError` with message "Permission denied" = user clicked "Block"
- `NotAllowedError` with message "Permission dismissed" = user dismissed the prompt
- `NotFoundError` = no microphone device available
- `NotReadableError` = microphone is in use by another application

**Confidence:** HIGH -- based on MDN documentation and addpipe.com getUserMedia testing.

---

## 6. Error Handling & Resilience

### 6.1 Network Interruption Recovery

**WebSocket reconnection strategy with exponential backoff:**

```typescript
class AudioWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseDelay = 1000; // 1 second
  private maxDelay = 30000; // 30 seconds
  private pendingChunks: ArrayBuffer[] = [];

  connect(url: string): void {
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      // Flush any chunks buffered during reconnection
      this.flushPendingChunks();
    };

    this.ws.onclose = (event) => {
      if (!event.wasClean) {
        this.scheduleReconnect(url);
      }
    };

    this.ws.onerror = () => {
      // Error is always followed by close; reconnection handled in onclose
    };
  }

  private scheduleReconnect(url: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Notify user that connection cannot be re-established
      return;
    }
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000,
      this.maxDelay
    );
    this.reconnectAttempts++;
    setTimeout(() => this.connect(url), delay);
  }

  send(chunk: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
    } else {
      // Buffer chunks during disconnection (with size limit)
      if (this.pendingChunks.length < 50) {
        this.pendingChunks.push(chunk);
      }
    }
  }

  private flushPendingChunks(): void {
    while (this.pendingChunks.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(this.pendingChunks.shift()!);
    }
  }
}
```

**Important:** For audio streaming, buffering during disconnection has limited value. Old audio chunks become stale quickly. Consider discarding buffered audio after more than ~2 seconds of disconnection and instead sending a "resync" signal to the STT service.

### 6.2 Microphone Disconnection Handling

```typescript
// Monitor for device changes (e.g., headset unplugged)
navigator.mediaDevices.addEventListener('devicechange', async () => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const hasAudioInput = devices.some(d => d.kind === 'audioinput');
  if (!hasAudioInput) {
    // Pause the triage session, notify user
    handleMicrophoneDisconnected();
  }
});

// Monitor the MediaStreamTrack for unexpected end
const audioTrack = stream.getAudioTracks()[0];
audioTrack.addEventListener('ended', () => {
  // Track ended (device disconnected, permission revoked, etc.)
  handleMicrophoneDisconnected();
});
```

### 6.3 Echo Cancellation and Noise Suppression

Browser-built-in audio processing is enabled via `getUserMedia` constraints:

| Feature | Chrome | Firefox | Safari | Notes |
|---------|--------|---------|--------|-------|
| `echoCancellation` | Default ON | Default ON | Default ON (buggy in older versions) | AEC needs 2-5s adaptation time |
| `noiseSuppression` | Default ON | Default ON | Not supported | Chrome applies even if not requested |
| `autoGainControl` | Default ON | Default OFF | Default ON | Chrome ties to echoCancellation |

### 6.4 Audio Feedback Prevention (Speaker -> Microphone Loop)

In our architecture, the AI speaks through the speakers while the microphone is active. Without mitigation, the microphone picks up the AI's speech, creating a feedback loop.

**Multi-layered prevention strategy:**

1. **Browser AEC (primary):** `echoCancellation: true` in `getUserMedia` constraints. The browser's built-in Acoustic Echo Cancellation learns the speaker-to-microphone path and subtracts it. Allow 2-5 seconds for adaptation.

2. **Mute microphone during TTS playback (secondary):** When the AI is speaking, temporarily disable audio capture or set a flag to discard captured audio on the server. This is the most reliable approach but prevents barge-in (patient interrupting the AI).

3. **VAD-aware gating:** The VAD model can distinguish between speech from the speaker and the patient. When the AI is speaking, raise the VAD speech probability threshold to ignore low-confidence detections.

4. **Use `<audio>` element for TTS playback (not Web Audio API directly):** Chromium's AEC works better when playback goes through an `<audio>` element rather than directly through `AudioContext.destination`. This is a known Chromium implementation detail.

5. **Use headphones recommendation:** For medical triage accuracy, recommend headphone use in the UI. This eliminates acoustic coupling entirely.

**Confidence:** HIGH for strategies 1-2, MEDIUM for strategy 4 (based on Chromium-specific behavior reports).

---

## 7. Code Patterns

### 7.1 Getting Microphone Access with Error Handling

```typescript
// lib/audio/microphone.ts

export type MicrophoneError =
  | { type: 'not-allowed'; dismissed: boolean }
  | { type: 'not-found' }
  | { type: 'not-readable' }
  | { type: 'not-supported' }
  | { type: 'unknown'; message: string };

export type MicrophoneResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; error: MicrophoneError };

export async function requestMicrophone(): Promise<MicrophoneResult> {
  // Check if getUserMedia is available
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, error: { type: 'not-supported' } };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        // sampleRate: 16000, // Hint; may be ignored by browser
      },
    });

    return { ok: true, stream };
  } catch (err) {
    if (err instanceof DOMException) {
      switch (err.name) {
        case 'NotAllowedError':
          return {
            ok: false,
            error: {
              type: 'not-allowed',
              dismissed: err.message.includes('dismissed'),
            },
          };
        case 'NotFoundError':
          return { ok: false, error: { type: 'not-found' } };
        case 'NotReadableError':
          return { ok: false, error: { type: 'not-readable' } };
        default:
          return { ok: false, error: { type: 'unknown', message: err.message } };
      }
    }
    return {
      ok: false,
      error: { type: 'unknown', message: String(err) },
    };
  }
}

export async function checkMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    const result = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    return result.state;
  } catch {
    return 'prompt'; // Permissions API not supported
  }
}
```

### 7.2 AudioWorklet Processor for Real-time Audio Processing

```typescript
// public/worklets/pcm-processor.worklet.ts
// This file runs in the AudioWorklet thread (separate from main thread)

class PCMProcessor extends AudioWorkletProcessor {
  private buffer: Float32Array;
  private bufferIndex: number;
  private readonly targetSampleRate: number;
  private readonly inputSampleRate: number;
  private readonly chunkDurationMs: number;
  private readonly chunkSize: number;

  constructor(options: AudioWorkletNodeOptions) {
    super();

    // Configuration passed from main thread
    const processorOptions = options.processorOptions || {};
    this.targetSampleRate = processorOptions.targetSampleRate || 16000;
    this.inputSampleRate = processorOptions.inputSampleRate || 48000;
    this.chunkDurationMs = processorOptions.chunkDurationMs || 200;

    // Calculate chunk size in samples at target sample rate
    this.chunkSize = Math.floor(
      (this.targetSampleRate * this.chunkDurationMs) / 1000
    );

    // Pre-allocate buffer to avoid GC in audio thread
    this.buffer = new Float32Array(this.chunkSize);
    this.bufferIndex = 0;

    this.port.onmessage = (event) => {
      if (event.data.type === 'stop') {
        // Flush remaining buffer
        if (this.bufferIndex > 0) {
          this.flushBuffer();
        }
      }
    };
  }

  process(
    inputs: Float32Array[][],
    _outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>
  ): boolean {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true; // Keep alive even with no input
    }

    const channelData = input[0]; // Mono - first channel only

    // Simple linear downsampling from input rate to target rate
    const ratio = this.inputSampleRate / this.targetSampleRate;
    for (let i = 0; i < channelData.length; i++) {
      // Only take samples at the target rate interval
      const targetIndex = i / ratio;
      if (
        Math.floor(targetIndex) !== Math.floor((i - 1) / ratio) ||
        i === 0
      ) {
        if (this.bufferIndex < this.chunkSize) {
          this.buffer[this.bufferIndex++] = channelData[i];
        }
      }
    }

    // When buffer is full, send the chunk
    if (this.bufferIndex >= this.chunkSize) {
      this.flushBuffer();
    }

    return true; // Keep processor alive
  }

  private flushBuffer(): void {
    // Convert Float32 [-1.0, 1.0] to Int16 [-32768, 32767]
    const pcm16 = new Int16Array(this.bufferIndex);
    for (let i = 0; i < this.bufferIndex; i++) {
      const s = Math.max(-1, Math.min(1, this.buffer[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // Send PCM data to main thread via MessagePort
    this.port.postMessage(
      { type: 'pcm-chunk', data: pcm16.buffer },
      [pcm16.buffer] // Transfer ownership (zero-copy)
    );

    // Reset buffer index (buffer array is reused)
    this.bufferIndex = 0;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
```

### 7.3 Main Thread: AudioWorklet Setup and WebSocket Streaming

```typescript
// lib/audio/audio-pipeline.ts

export class AudioPipeline {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private ws: WebSocket | null = null;
  private isActive = false;

  async start(stream: MediaStream, wsUrl: string): Promise<void> {
    // Create AudioContext (must be after user gesture on iOS Safari)
    this.audioContext = new AudioContext({ sampleRate: 48000 });

    // Ensure context is running (iOS Safari may start it suspended)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Load the AudioWorklet processor module
    await this.audioContext.audioWorklet.addModule('/worklets/pcm-processor.worklet.js');

    // Create source from microphone stream
    this.sourceNode = this.audioContext.createMediaStreamSource(stream);

    // Create worklet node with configuration
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor', {
      processorOptions: {
        targetSampleRate: 16000,
        inputSampleRate: this.audioContext.sampleRate,
        chunkDurationMs: 200,
      },
    });

    // Handle PCM chunks from the worklet
    this.workletNode.port.onmessage = (event) => {
      if (event.data.type === 'pcm-chunk' && this.isActive) {
        this.sendAudioChunk(event.data.data);
      }
    };

    // Connect the pipeline: mic -> worklet
    // Note: we do NOT connect to destination (speakers) to avoid feedback
    this.sourceNode.connect(this.workletNode);

    // Connect WebSocket
    this.connectWebSocket(wsUrl);

    this.isActive = true;
  }

  private connectWebSocket(url: string): void {
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      console.log('[AudioPipeline] WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        // TTS audio response
        this.playAudioChunk(event.data);
      } else {
        // Text event (transcript, response text, status)
        const message = JSON.parse(event.data);
        this.handleTextMessage(message);
      }
    };

    this.ws.onclose = () => {
      if (this.isActive) {
        // Reconnect logic (see Section 6.1)
      }
    };
  }

  private sendAudioChunk(chunk: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
    }
  }

  private handleTextMessage(message: unknown): void {
    // Handle transcripts, AI responses, status updates
    // Emit to React state via callback or event
  }

  private playAudioChunk(chunk: ArrayBuffer): void {
    // See Section 7.4 for playback queue implementation
  }

  async stop(): Promise<void> {
    this.isActive = false;

    // Signal the worklet to flush its buffer
    this.workletNode?.port.postMessage({ type: 'stop' });

    // Disconnect all nodes
    this.sourceNode?.disconnect();
    this.workletNode?.disconnect();

    // Close WebSocket
    this.ws?.close();

    // Close AudioContext to release all resources
    await this.audioContext?.close();

    this.audioContext = null;
    this.workletNode = null;
    this.sourceNode = null;
    this.ws = null;
  }
}
```

### 7.4 Audio Playback Queue Management

```typescript
// lib/audio/playback-queue.ts

export class AudioPlaybackQueue {
  private audioContext: AudioContext;
  private queue: AudioBuffer[] = [];
  private isPlaying = false;
  private nextPlayTime = 0;
  private onPlaybackStart?: () => void;
  private onPlaybackEnd?: () => void;

  constructor(
    audioContext: AudioContext,
    callbacks?: {
      onPlaybackStart?: () => void;
      onPlaybackEnd?: () => void;
    }
  ) {
    this.audioContext = audioContext;
    this.onPlaybackStart = callbacks?.onPlaybackStart;
    this.onPlaybackEnd = callbacks?.onPlaybackEnd;
  }

  /**
   * Enqueue a raw PCM audio chunk for sequential playback.
   * Chunks are played back-to-back with no gaps using
   * AudioBufferSourceNode scheduling.
   */
  async enqueue(pcmData: ArrayBuffer, sampleRate: number = 24000): Promise<void> {
    // Decode the incoming audio data
    // For raw PCM, we manually create an AudioBuffer
    const int16 = new Int16Array(pcmData);
    const float32 = new Float32Array(int16.length);

    // Convert Int16 to Float32
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 0x7fff;
    }

    const audioBuffer = this.audioContext.createBuffer(
      1, // mono
      float32.length,
      sampleRate
    );
    audioBuffer.copyToChannel(float32, 0);

    this.queue.push(audioBuffer);

    if (!this.isPlaying) {
      this.startPlayback();
    }
  }

  /**
   * Enqueue encoded audio (e.g., MP3, OGG from TTS service)
   */
  async enqueueEncoded(encodedData: ArrayBuffer): Promise<void> {
    const audioBuffer = await this.audioContext.decodeAudioData(encodedData);
    this.queue.push(audioBuffer);

    if (!this.isPlaying) {
      this.startPlayback();
    }
  }

  private startPlayback(): void {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.onPlaybackEnd?.();
      return;
    }

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.nextPlayTime = this.audioContext.currentTime;
      this.onPlaybackStart?.();
    }

    const buffer = this.queue.shift()!;
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    // Schedule playback at the precise time to avoid gaps
    source.start(this.nextPlayTime);
    this.nextPlayTime += buffer.duration;

    // When this buffer finishes, play the next one
    source.onended = () => {
      if (this.queue.length > 0) {
        this.startPlayback();
      } else {
        this.isPlaying = false;
        this.onPlaybackEnd?.();
      }
    };
  }

  /**
   * Clear the queue and stop all playback (e.g., when patient interrupts)
   */
  clear(): void {
    this.queue = [];
    this.isPlaying = false;
    this.nextPlayTime = 0;
    // Note: currently playing AudioBufferSourceNode will finish naturally
    // For immediate stop, track active source nodes and call .stop()
  }

  get length(): number {
    return this.queue.length;
  }

  get playing(): boolean {
    return this.isPlaying;
  }
}
```

### 7.5 WebSocket Server for Audio Relay (Node.js)

```typescript
// server/ws-audio-server.ts
// Standalone WebSocket server for audio relay

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

interface AudioSession {
  id: string;
  clientWs: WebSocket;
  sttWs: WebSocket | null;
  createdAt: Date;
}

const sessions = new Map<string, AudioSession>();

const server = createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket, req) => {
  const sessionId = crypto.randomUUID();

  const session: AudioSession = {
    id: sessionId,
    clientWs: ws,
    sttWs: null,
    createdAt: new Date(),
  };

  sessions.set(sessionId, session);
  console.log(`[WS] New audio session: ${sessionId}`);

  // Connect to STT service (e.g., Deepgram)
  connectToSTT(session);

  ws.on('message', (data: Buffer) => {
    // Forward audio chunks to STT service
    if (session.sttWs?.readyState === WebSocket.OPEN) {
      session.sttWs.send(data);
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Session closed: ${sessionId}`);
    session.sttWs?.close();
    sessions.delete(sessionId);
  });

  ws.on('error', (err) => {
    console.error(`[WS] Session error: ${sessionId}`, err);
  });
});

function connectToSTT(session: AudioSession): void {
  // Example: Deepgram streaming STT connection
  const sttUrl = 'wss://api.deepgram.com/v1/listen?' +
    'encoding=linear16&sample_rate=16000&channels=1&' +
    'language=pt-BR&model=nova-2&punctuate=true&' +
    'interim_results=true';

  const sttWs = new WebSocket(sttUrl, {
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
    },
  });

  sttWs.on('open', () => {
    console.log(`[STT] Connected for session: ${session.id}`);
    session.sttWs = sttWs;
  });

  sttWs.on('message', (data: Buffer) => {
    // Forward STT transcripts back to client
    if (session.clientWs.readyState === WebSocket.OPEN) {
      session.clientWs.send(data.toString());
    }
  });

  sttWs.on('close', () => {
    console.log(`[STT] Disconnected for session: ${session.id}`);
    session.sttWs = null;
  });

  sttWs.on('error', (err) => {
    console.error(`[STT] Error for session: ${session.id}`, err);
  });
}

const PORT = parseInt(process.env.WS_PORT || '3001', 10);
server.listen(PORT, () => {
  console.log(`[WS] Audio relay server listening on port ${PORT}`);
});
```

---

## Recommendations

### Primary Recommendations

1. **Audio Capture:** Use `getUserMedia()` with mono audio constraints (echoCancellation, noiseSuppression, autoGainControl all enabled) connected to an **AudioWorklet** pipeline. Do NOT use `ScriptProcessorNode` or `MediaRecorder` for real-time streaming.

2. **Audio Format:** Capture and stream as **PCM 16-bit, 16kHz, mono**. This is universally accepted by all major STT services and avoids encoding complexity. Bandwidth is only ~32 KB/s, which is acceptable even on mobile networks.

3. **Streaming Transport:** Use **WebSocket** for bidirectional audio streaming. Implement a **separate WebSocket server** (Node.js + `ws` library) running alongside the Next.js application, rather than trying to force WebSocket support into Next.js Route Handlers.

4. **Audio Chunking:** Buffer 200ms chunks (6400 bytes at 16kHz/16-bit) in the AudioWorklet before sending. This balances latency and network efficiency.

5. **Voice Activity Detection:** Use **@ricky0123/vad-react** with the Silero VAD ONNX model for browser-based VAD. This provides speech boundary detection without push-to-talk, and integrates cleanly with React.

6. **TTS Playback:** Implement a playback queue using Web Audio API `AudioBufferSourceNode` with precise scheduling (`source.start(nextPlayTime)`) to ensure gapless playback of TTS response chunks.

7. **iOS Safari:** Ensure all AudioContext creation and `getUserMedia` calls happen within user gesture event handlers. Provide a clear "Start Consultation" button that initiates the entire audio pipeline.

### Architecture Decision

For the audio pipeline architecture, I recommend the **composed approach** (separate STT + LLM + TTS services) with a Node.js WebSocket relay server. This provides:
- Full control over each component
- Ability to swap services independently
- Better cost optimization (different services for different functions)
- Data sovereignty control (important for LGPD compliance)

However, the **OpenAI Realtime API** should be evaluated as an alternative (see Research B) since it dramatically simplifies the architecture at the potential cost of flexibility and higher per-minute pricing.

---

## Open Questions

1. **Sample rate negotiation:** If the browser captures at 48kHz (ignoring our 16kHz hint), should we resample in the AudioWorklet (simple but lower quality) or on the server (better quality but adds latency)?

2. **Barge-in support:** Should the patient be able to interrupt the AI while it is speaking? This requires echo cancellation to work perfectly or a more sophisticated VAD approach. Initial implementation could disable barge-in (mute mic during TTS) and add it later.

3. **WebSocket server deployment:** Where will the WebSocket relay server be hosted? Options: same machine as Next.js (simplest), separate container/service (more scalable), or managed service like PartyKit (least maintenance). The choice affects LGPD compliance (data residency) and latency.

4. **Audio recording for compliance:** LGPD and CFM regulations may require storing audio recordings of medical consultations. If so, we need a parallel recording pipeline (possibly using `MediaRecorder` to produce a WAV/WebM file uploaded to Supabase Storage at the end of the session). This needs legal review.

5. **Opus encoding value:** Is the bandwidth savings from Opus encoding (8-16 KB/s vs. 32 KB/s for PCM) worth the additional complexity (WebCodecs or WASM library, Safari fallback)? For initial implementation, PCM is simpler and sufficient.

6. **AudioWorklet file serving:** The AudioWorklet processor file must be served as a separate JavaScript file (it runs in a different global scope). How should this be handled in the Next.js build pipeline? Options: `public/` directory (simplest), webpack/turbopack plugin, or inline via Blob URL.

7. **Multi-tab behavior:** What happens if the patient opens the triage page in multiple tabs? Only one tab can access the microphone. Need to detect and handle this gracefully.

---

## Sources

### Official Documentation (HIGH confidence)
- [MDN: Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MDN: AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
- [MDN: AudioWorkletProcessor.process()](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process)
- [MDN: Using AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet)
- [MDN: MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [MDN: MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN: MediaTrackSettings](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings)
- [MDN: WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [MDN: AudioEncoder](https://developer.mozilla.org/en-US/docs/Web/API/AudioEncoder)
- [MDN: Autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)
- [Can I Use: AudioWorklet](https://caniuse.com/mdn-api_audioworklet)
- [Can I Use: MediaRecorder](https://caniuse.com/mediarecorder)
- [Can I Use: WebCodecs](https://caniuse.com/webcodecs)
- [Chrome Developers: Audio Worklet](https://developer.chrome.com/blog/audio-worklet)
- [W3C: WebCodecs Opus Registration](https://www.w3.org/TR/webcodecs-opus-codec-registration/)
- [W3C: Linear PCM WebCodecs Registration](https://w3c.github.io/webcodecs/pcm_codec_registration.html)
- [W3C TPAC 2025: Audio WG Update](https://www.w3.org/2025/11/TPAC/demo-audio-wg-update.html)

### STT Service Documentation (HIGH confidence)
- [Google Cloud: Optimizing Audio for Speech-to-Text](https://cloud.google.com/speech-to-text/docs/optimizing-audio-files-for-speech-to-text)
- [Google Cloud: Audio Encoding](https://cloud.google.com/speech-to-text/docs/encoding)
- [Deepgram: Encoding](https://developers.deepgram.com/docs/encoding)
- [Deepgram: Live Audio Streaming](https://developers.deepgram.com/reference/speech-to-text/listen-streaming)
- [OpenAI: Realtime API](https://platform.openai.com/docs/guides/realtime)
- [OpenAI: Audio API Reference](https://platform.openai.com/docs/api-reference/audio/)
- [Azure: Audio Concepts](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/concepts/audio-concepts)
- [AssemblyAI: Best Audio Formats for STT](https://www.assemblyai.com/blog/best-audio-file-formats-for-speech-to-text)

### Next.js WebSocket Resources (HIGH confidence)
- [Next.js GitHub Discussion #58698: WebSocket Upgrade in Route Handlers](https://github.com/vercel/next.js/discussions/58698)
- [next-ws: WebSockets in Next.js App Router](https://github.com/apteryxxyz/next-ws)
- [Fly.io: WebSockets with Next.js](https://fly.io/javascript-journal/websockets-with-nextjs/)
- [Next.js: Route Handlers Documentation](https://nextjs.org/docs/app/getting-started/route-handlers)

### VAD Libraries (HIGH confidence)
- [@ricky0123/vad: Voice Activity Detector](https://github.com/ricky0123/vad)
- [@ricky0123/vad-react: React Integration](https://docs.vad.ricky0123.com/user-guide/react/)
- [Silero VAD: Pre-trained Voice Activity Detector](https://github.com/snakers4/silero-vad)
- [Picovoice: Best VAD 2025 Comparison](https://picovoice.ai/blog/best-voice-activity-detection-vad-2025/)
- [Picovoice: Complete Guide to VAD 2026](https://picovoice.ai/blog/complete-guide-voice-activity-detection-vad/)

### Audio Encoding Libraries (MEDIUM confidence)
- [opus-recorder: Opus/WAV Encoding via WASM](https://github.com/chris-rudmin/opus-recorder)
- [opus-decoder: Ogg Opus Decoding via WASM](https://github.com/AnthumChris/opus-stream-decoder)
- [fetch-stream-audio: Low-latency Audio Playback](https://github.com/AnthumChris/fetch-stream-audio)

### Platform-Specific Resources (MEDIUM confidence)
- [PartyKit: Real-time Serverless Platform](https://www.partykit.io/)
- [PartyKit: How It Works](https://docs.partykit.io/how-partykit-works/)

### Best Practices and Guides (MEDIUM confidence)
- [addpipe.com: getUserMedia Audio Constraints](https://blog.addpipe.com/audio-constraints-getusermedia/)
- [addpipe.com: Common getUserMedia Errors](https://blog.addpipe.com/common-getusermedia-errors/)
- [addpipe.com: Getting Started with getUserMedia 2025](https://blog.addpipe.com/getusermedia-getting-started/)
- [addpipe.com: Safari MediaRecorder Audio](https://blog.addpipe.com/record-high-quality-audio-in-safari-with-alac-and-pcm-support-via-mediarecorder/)
- [web.dev: Process Audio from Microphone](https://web.dev/patterns/media/microphone-process)
- [web.dev: Profiling Web Audio Apps](https://web.dev/profiling-web-audio-apps-in-chrome/)
- [DEV Community: Echo Cancellation with Web Audio API](https://dev.to/focused_dot_io/echo-cancellation-with-web-audio-api-and-chromium-1f8m)
- [DEV Community: Audio Feedback Prevention](https://dev.to/fosteman/how-to-prevent-speaker-feedback-in-speech-transcription-using-web-audio-api-2da4)
- [WebSocket Reconnection Strategies](https://dev.to/hexshift/robust-websocket-reconnection-strategies-in-javascript-with-exponential-backoff-40n1)
- [Medium: Streaming 16-bit Mono PCM from Browser](https://medium.com/developer-rants/streaming-audio-with-16-bit-mono-pcm-encoding-from-the-browser-and-how-to-mix-audio-while-we-are-f6a160409135)
- [HackerNoon: Streaming in Next.js 15 - WebSockets vs SSE](https://hackernoon.com/streaming-in-nextjs-15-websockets-vs-server-sent-events)
- [Northflank: Best Open Source STT 2026](https://northflank.com/blog/best-open-source-speech-to-text-stt-model-in-2026-benchmarks)
