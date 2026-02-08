# Research 1B-B: ElevenLabs Architecture & Integration
**Researcher:** Agent B (Integration Focus)
**Date:** 2026-02-08
**Confidence:** HIGH for Sections 1-5, MEDIUM for Sections 6-8

---

## Executive Summary

ElevenLabs Conversational AI (now branded as "ElevenLabs Agents Platform") is a fully managed, real-time voice agent infrastructure that bundles STT, LLM orchestration, TTS, VAD, and turn-taking into a single platform. The browser connects via **WebSocket or WebRTC** using the official `@elevenlabs/react` SDK, which handles microphone capture, voice activity detection, audio playback, and connection management -- **eliminating the need for a custom WebSocket server, custom AudioWorklet pipeline, @ricky0123/vad-web, and custom audio playback queue**.

This is a paradigm shift from the previously researched "composed pipeline" (Deepgram STT + GPT-4o-mini + OpenAI TTS + custom WebSocket relay). With ElevenLabs centralized, the client-side code collapses to a single `useConversation()` React hook, and the server-side work reduces to a single Next.js Route Handler that generates signed URLs or ephemeral tokens.

**Critical findings:**
1. **Custom tools / function calling IS supported** -- both client-side callbacks and server-side webhook tools. This enables `save_symptom()`, `check_emergency()`, and `end_consultation()` integration with Supabase.
2. **The Vercel deployment problem IS solved** -- no custom WebSocket server needed. The browser connects directly to ElevenLabs infrastructure.
3. **WebRTC is the recommended connection type** -- provides echo cancellation, noise removal, and lower latency than WebSocket.
4. **Post-call webhooks** deliver full transcripts, analysis, and extracted data to our Next.js API routes.
5. **Vendor lock-in is MODERATE** -- system prompts and tool definitions are portable; the SDK integration layer is not.

**Pricing:** $0.08-$0.10/minute (Business plan annual). A 10-minute triage conversation costs ~$0.80-$1.00. This is more expensive than the composed pipeline ($0.14/conversation) but eliminates significant engineering complexity.

---

## 1. ElevenLabs Conversational AI -- Client Integration

### 1.1 Connection Protocol

The browser connects to ElevenLabs Conversational AI via one of two protocols:

| Protocol | Use Case | Latency | Echo Cancellation | Recommended |
|----------|----------|---------|-------------------|-------------|
| **WebSocket** | Default, broader compatibility | Higher | Browser-dependent | No |
| **WebRTC** | Production voice apps | Lower | Built-in (battle-tested) | **Yes** |

ElevenLabs has migrated all usage on 11.ai to WebRTC due to "dramatically improved client SDK performance and conversation quality." WebRTC provides built-in echo cancellation and background noise removal that has been tested across billions of video calls -- something the composed pipeline's custom AudioWorklet approach could never match.

**Confidence: HIGH** -- Verified from official ElevenLabs blog post and SDK documentation.

### 1.2 SDK Abstraction -- What It Handles

The `@elevenlabs/react` SDK (current version: 0.13.0) provides the `useConversation()` hook that handles:

| Component | Previously Required | With ElevenLabs SDK |
|-----------|-------------------|-------------------|
| Microphone capture | Custom `getUserMedia` + `AudioWorklet` | SDK handles internally |
| Voice Activity Detection (VAD) | `@ricky0123/vad-web` (7-10 MB Silero model) | Built-in server-side VAD |
| Audio streaming | Custom WebSocket client + PCM encoding | SDK handles via WebRTC/WS |
| Audio playback | Custom `AudioPlaybackQueue` | SDK handles internally |
| Echo cancellation | Browser AEC (unreliable on Safari) | WebRTC AEC (reliable) |
| Turn detection | Custom silence threshold logic | Platform-level configuration |
| Reconnection | Custom exponential backoff | SDK handles internally |

**This eliminates the need for:**
- Custom AudioWorklet pipeline (Research A, Section 7)
- Custom WebSocket server (`server/ws-audio-server.ts`)
- `@ricky0123/vad-web` and Silero ONNX model download
- Custom audio playback queue (Research A, Section 7.4)
- Custom barge-in / interruption handling (Research C, Section 2)
- The entire 16kHz vs 24kHz sample rate debate (Research Review, Section 1.1)

**Confidence: HIGH** -- Verified from official SDK documentation and npm package.

### 1.3 Client-Side Code Example (React / Next.js)

```tsx
"use client";

import { useConversation } from "@elevenlabs/react";
import { useCallback, useState } from "react";

export function TriageVoiceAgent({ patientName }: { patientName: string }) {
  const [transcript, setTranscript] = useState<Array<{role: string, text: string}>>([]);

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to ElevenLabs agent");
    },
    onDisconnect: () => {
      console.log("Disconnected from agent");
      // Trigger post-conversation processing
    },
    onMessage: ({ message, source }) => {
      // Real-time transcript display
      setTranscript(prev => [...prev, {
        role: source === "ai" ? "agent" : "patient",
        text: message,
      }]);
    },
    onError: (error) => {
      console.error("Conversation error:", error);
    },
    onStatusChange: (status) => {
      // status: "connected" | "connecting" | "disconnected"
      console.log("Status:", status);
    },
    // Client-side tool callbacks
    clientTools: {
      save_symptom: async (parameters: { symptom: string; severity: string }) => {
        // Call our Next.js API to save to Supabase
        await fetch("/api/triage/symptom", {
          method: "POST",
          body: JSON.stringify(parameters),
        });
        return "Symptom saved successfully";
      },
      check_emergency: async (parameters: { symptoms: string[] }) => {
        const res = await fetch("/api/triage/emergency-check", {
          method: "POST",
          body: JSON.stringify(parameters),
        });
        const data = await res.json();
        return JSON.stringify(data); // Return urgency classification to agent
      },
    },
  });

  const startTriage = useCallback(async () => {
    // Request microphone permission explicitly first
    await navigator.mediaDevices.getUserMedia({ audio: true });

    // Get signed URL from our backend (protects API key)
    const res = await fetch("/api/elevenlabs/signed-url");
    const { signedUrl } = await res.json();

    // Start the conversation session
    const conversationId = await conversation.startSession({
      signedUrl,
      connectionType: "webrtc",
      overrides: {
        agent: {
          prompt: {
            prompt: `Patient name: ${patientName}. Conduct medical anamnesis in pt-BR.`,
          },
          firstMessage: `Ola ${patientName}! Sou o assistente de triagem virtual. Como posso ajuda-lo hoje?`,
        },
      },
    });

    console.log("Conversation started:", conversationId);
  }, [conversation, patientName]);

  const endTriage = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  return (
    <div>
      <button onClick={startTriage}>Iniciar Triagem</button>
      <button onClick={endTriage}>Encerrar</button>
      <p>Status: {conversation.status}</p>
      <p>Agent is speaking: {conversation.isSpeaking ? "Yes" : "No"}</p>
      {/* Real-time transcript */}
      <div>
        {transcript.map((msg, i) => (
          <p key={i}><strong>{msg.role}:</strong> {msg.text}</p>
        ))}
      </div>
    </div>
  );
}
```

**Confidence: HIGH** -- Code pattern verified from official documentation, SDK README, and example repositories.

### 1.4 iOS Safari Autoplay Restrictions

The SDK handles iOS Safari audio restrictions by requiring a user gesture (button click) before calling `startSession()`. The microphone permission must be requested via `navigator.mediaDevices.getUserMedia()` before the conversation begins. The SDK documentation explicitly states:

> "The microphone may be blocked for the current page by default, resulting in the allow prompt not showing up at all. You should handle this use case in your application and display an appropriate message to the user."

Additionally, for iOS devices with Bluetooth headphones, the SDK provides a `preferHeadphonesForIosDevices: true` option, though this is not guaranteed by the browser.

**For our use case:** The patient consent flow (Phase 2) naturally provides the user gesture needed. After accepting the LGPD consent terms, the "Iniciar Triagem" button click satisfies both consent and audio autoplay requirements.

**Confidence: MEDIUM** -- Based on SDK documentation. Needs hands-on iOS Safari testing.

### 1.5 Bundle Size

The exact bundle size of `@elevenlabs/react` is not published on Bundlephobia. However, based on analysis:
- The package is a thin wrapper around `@elevenlabs/client` (the core SDK)
- It provides React hooks (`useConversation`) and does not bundle heavy dependencies like ONNX runtime
- No Silero VAD model download required (VAD runs server-side on ElevenLabs infrastructure)
- Estimated bundle size: **~15-30 KB gzipped** (significantly smaller than `@ricky0123/vad-web` which requires 7-10 MB ONNX model download)

**Confidence: LOW** -- Estimated, not verified. Should be measured with `next/bundle-analyzer`.

### 1.6 Text-Only Mode

For scenarios where audio is not available, the SDK supports `textOnly` mode:

```tsx
const conversation = useConversation({ textOnly: true });
```

In text-only mode, no microphone permission is requested, no audio context is created, and the user interacts via `conversation.sendMessage("text input")`. This provides an automatic fallback for users who deny microphone access or use unsupported browsers.

**Confidence: HIGH** -- Documented in official SDK.

---

## 2. ElevenLabs Conversational AI -- Server/Backend Integration

### 2.1 Authentication: Signed URLs and Ephemeral Tokens

ElevenLabs provides two authentication mechanisms to protect the API key:

| Method | Connection Type | Expiry | Reusable |
|--------|----------------|--------|----------|
| **Signed URL** | WebSocket | 15 minutes | No (single connection) |
| **Conversation Token** | WebRTC | 15 minutes | No (single use) |

**Implementation in Next.js Route Handler:**

```typescript
// app/api/elevenlabs/signed-url/route.ts
import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  // 1. Verify user is authenticated via Supabase
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Verify user has patient role and active consent
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (role?.role !== "patient") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Request signed URL from ElevenLabs (API key stays server-side)
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${process.env.ELEVENLABS_AGENT_ID}`,
    {
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      },
    }
  );

  const data = await response.json();
  return NextResponse.json({ signedUrl: data.signed_url });
}
```

**Key security properties:**
- API key NEVER exposed to the client
- Signed URL is single-use (one WebSocket connection) and expires after 15 minutes
- If the signed URL expires, existing connections remain active, but new connections will fail
- Our Supabase auth middleware verifies the user session before issuing the URL
- ElevenLabs also supports domain allowlisting as a secondary security layer

**Recommendation:** Generate a new signed URL for each triage session. Use both signed URLs AND domain allowlisting for maximum security.

**Confidence: HIGH** -- Verified from official documentation and Next.js quickstart guide.

### 2.2 Passing Supabase User Context

There are three ways to inject user context into the conversation:

#### A. Overrides (at session start)

```typescript
await conversation.startSession({
  signedUrl,
  overrides: {
    agent: {
      prompt: {
        prompt: `You are conducting a medical triage for patient ${patientName}, age ${patientAge}. Previous conditions: ${previousConditions}.`,
      },
      firstMessage: `Ola ${patientName}! Sou o assistente de triagem virtual do consultorio. Como voce esta se sentindo hoje?`,
    },
  },
});
```

Overrides completely replace the corresponding agent configuration fields for that session. Only include fields you want to override.

#### B. Dynamic Variables (pre-configured in agent template)

Define variables like `{{patient_name}}`, `{{patient_age}}` in the agent's system prompt on the ElevenLabs dashboard. Then inject values at session start:

```typescript
await conversation.startSession({
  signedUrl,
  dynamicVariables: {
    patient_name: patientName,
    patient_age: String(patientAge),
  },
});
```

#### C. Contextual Updates (mid-conversation)

```typescript
// Inject context mid-conversation without triggering agent response
conversation.sendContextualUpdate(
  "Patient's previous consultation from 2 weeks ago showed elevated blood pressure. Consider this for follow-up questions, but do not react to this update directly."
);
```

This is powerful for our use case: when a client tool returns data from Supabase (e.g., patient history), we can inject that context without interrupting the conversation flow.

**Confidence: HIGH** -- All three methods documented in official SDK and personalization docs.

### 2.3 Do We Need ANY Backend Server for Voice?

**No.** The voice pipeline runs entirely between the browser and ElevenLabs infrastructure:

```
Browser (SDK) <--WebRTC/WS--> ElevenLabs Cloud (STT + LLM + TTS + VAD)
```

Our backend is needed only for:
1. **Signed URL generation** -- One Route Handler (`/api/elevenlabs/signed-url`)
2. **Server tool endpoints** -- Route Handlers that ElevenLabs calls during the conversation (e.g., to save data to Supabase)
3. **Post-call webhook receiver** -- Route Handler that receives conversation data after the call ends
4. **Client tool proxies** -- If client tools need authenticated Supabase access

We do NOT need:
- A custom WebSocket server
- A persistent Node.js process
- Any long-running server-side connections
- Audio processing infrastructure

**This is the key architectural win.** Everything deploys to Vercel serverless functions.

**Confidence: HIGH** -- Confirmed by architecture documentation and Next.js quickstart.

### 2.4 How Does the Conversation End?

The conversation can end via:

1. **Agent-initiated:** The `end_call` system tool allows the agent to end the conversation programmatically (e.g., when anamnesis is complete)
2. **Client-initiated:** `conversation.endSession()` from the React component
3. **User closes browser/tab:** WebSocket/WebRTC connection drops
4. **Timeout:** Configurable silence timeout

After the conversation ends, ElevenLabs:
1. Processes the full transcript
2. Runs configured data extraction (conversation analysis)
3. Fires the **post-call webhook** with full conversation data
4. Makes the conversation available via the GET Conversations API

**Data returned after conversation:**
- `conversation_id` (returned by `startSession()`)
- Full transcript (via API or webhook)
- Analysis results (configured data extraction)
- Audio recording (if audio saving is enabled)
- Conversation metadata (duration, status, agent version)

**Confidence: HIGH** -- Verified from API reference and post-call webhook documentation.

---

## 3. Custom Tools / Function Calling

### 3.1 Overview of Tool Types

ElevenLabs supports **three categories of tools**:

| Tool Type | Execution Location | Latency Impact | Use Case |
|-----------|-------------------|----------------|----------|
| **Client Tools** | Browser (callback) | Low (~50-100ms) | UI updates, browser actions |
| **Server Tools** | External HTTP endpoint | Medium (~200-500ms) | Database writes, API calls |
| **System Tools** | ElevenLabs platform | Minimal | End call, transfer, skip turn |

### 3.2 Client Tools -- Implementation for Triagem Virtual

Client tools are defined as JavaScript callbacks in the `useConversation()` hook. When the agent decides to call a tool, the SDK invokes the corresponding callback in the browser.

```typescript
const conversation = useConversation({
  clientTools: {
    // Tool 1: Save a reported symptom
    save_symptom: async (params: { symptom: string; severity: string; duration: string }) => {
      const res = await fetch("/api/triage/save-symptom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultationId: currentConsultationId,
          ...params,
        }),
      });
      if (res.ok) return "Symptom recorded successfully";
      return "Failed to save symptom";
    },

    // Tool 2: Check for emergency conditions
    check_emergency: async (params: { symptoms: string[] }) => {
      const res = await fetch("/api/triage/emergency-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms: params.symptoms }),
      });
      const result = await res.json();
      // Result returned to agent influences conversation behavior
      return JSON.stringify(result);
      // e.g., { urgency: "emergency", action: "recommend_samu_192" }
    },

    // Tool 3: Display emergency instructions in UI
    show_emergency_alert: async (params: { message: string; phone: string }) => {
      // Trigger UI state change in React
      setEmergencyAlert({ message: params.message, phone: params.phone });
      return "Emergency alert displayed to patient";
    },
  },
});
```

**Critical detail:** Client tool names and parameter definitions must match EXACTLY between the ElevenLabs agent configuration (dashboard or API) and the client-side code. The agent configuration defines WHEN to call tools (via descriptions); the client code defines WHAT happens.

**If a tool is invoked but not registered in clientTools**, the `onUnhandledClientToolCall` callback fires -- useful for debugging.

### 3.3 Server Tools -- Implementation for Supabase Integration

Server tools are HTTP endpoints that ElevenLabs calls directly during the conversation. They are ideal for operations that require server-side secrets (like the Supabase service role key).

**Configuration in ElevenLabs Dashboard (or API):**
- Tool name: `end_consultation`
- Tool type: Webhook
- URL: `https://your-app.vercel.app/api/triage/end-consultation`
- Method: POST
- Authentication: Bearer token (stored as ElevenLabs secret)
- Parameters:
  - `summary` (string): Clinical summary generated by the agent
  - `urgency` (string): Classification (emergency/urgent/semi-urgent/non-urgent)
  - `symptoms` (array): List of identified symptoms

**Our Next.js Route Handler receiving the server tool call:**

```typescript
// app/api/triage/end-consultation/route.ts
export async function POST(request: Request) {
  // Verify the request comes from ElevenLabs (bearer token or HMAC)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ELEVENLABS_TOOL_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { summary, urgency, symptoms, conversation_id } = body;

  // Save to Supabase using service role client
  const supabase = createServiceRoleClient();
  await supabase.from("consultations").update({
    status: "completed",
    ai_summary: summary,
    urgency_level: urgency,
    symptoms_extracted: symptoms,
    elevenlabs_conversation_id: conversation_id,
  }).eq("id", currentConsultationId);

  return Response.json({ success: true });
}
```

**Authentication methods supported for server tools:**
- Bearer token (stored as ElevenLabs secret)
- OAuth2 client credentials
- JWT Bearer flow
- HTTP Basic Auth
- Custom headers with secrets

### 3.4 System Tools Relevant to Our Use Case

| System Tool | Purpose | Configuration |
|-------------|---------|---------------|
| `end_call` | Agent ends call when triage is complete | Added by default; conditions configurable in prompt |
| `skip_turn` | Agent stays silent, waits for more input | Useful when patient is still thinking |

The `end_call` tool is particularly important: the system prompt should instruct the agent to call `end_call` after completing the anamnesis and providing a summary to the patient.

### 3.5 Latency Impact of Tool Calls

- **Client tools:** Add ~50-200ms (browser roundtrip to our API + Supabase write). The agent pauses briefly while waiting for the response.
- **Server tools:** Add ~200-800ms (ElevenLabs calls our endpoint, which writes to Supabase, returns response). More noticeable pause.
- **Mitigation:** The system prompt should instruct the agent to use filler phrases during tool calls: "Deixe-me anotar isso..." (Let me note that down...)

### 3.6 Tool Definition Best Practices

From the ElevenLabs prompting guide:
- Add descriptions to ALL parameters to help the LLM construct tool calls accurately
- Clearly define in the system prompt WHEN and HOW each tool should be used
- The choice of LLM matters: GPT-4o, Claude Sonnet, and Gemini models handle function calling well; smaller models may struggle with parameter extraction
- Do not rely solely on tool descriptions -- provide usage context and sequencing logic in the system prompt

**Confidence: HIGH** -- All three tool types documented in official docs with examples.

---

## 4. Conversation Configuration for Medical Use

### 4.1 System Prompt Configuration

The system prompt is configured in the ElevenLabs agent settings (dashboard or API). It defines the agent's behavior, personality, and medical anamnesis protocol.

**Maximum system prompt size:** 2 MB (includes instructions + knowledge base content).

**Example medical triage system prompt structure:**

```
You are a virtual triage assistant at a Brazilian medical clinic. You conduct medical anamneses in Portuguese (pt-BR) with empathy and professionalism.

## Your Role
- Collect complete medical history following standard anamnesis protocol
- You are NOT a doctor. NEVER diagnose or prescribe medication
- Maintain a warm, empathetic, professional tone throughout

## Anamnesis Protocol
Follow this sequence, adapting naturally to the conversation:
1. Chief Complaint (Queixa Principal - QP)
2. History of Present Illness (Historia da Doenca Atual - HDA)
3. Past Medical History (Antecedentes Pessoais)
4. Family History (Antecedentes Familiares)
5. Medications and Allergies
6. Review of Systems (brief, targeted)

## Emergency Protocol
If the patient reports: chest pain, difficulty breathing, loss of consciousness, stroke symptoms, severe bleeding, or suicidal ideation:
- Immediately call the check_emergency tool
- If urgency is "emergency", advise calling SAMU (192) immediately
- Call the show_emergency_alert tool to display emergency info
- Do NOT continue routine anamnesis for emergencies

## Tool Usage
- Call save_symptom for each distinct symptom reported
- Call check_emergency if any red-flag symptoms are mentioned
- Call end_consultation with structured summary when anamnesis is complete
- Use natural filler phrases while tools execute: "Deixe-me anotar isso..."

## Guardrails
- Never provide diagnoses or differential diagnoses to the patient
- Never recommend specific medications
- If asked for medical advice, say: "Essa orientacao deve ser dada pelo medico que vai analisar sua triagem"
- Keep the conversation focused on symptom collection
```

### 4.2 First Message Configuration

The first message is what the agent speaks when the conversation begins:

```
Ola! Sou o assistente de triagem virtual. Estou aqui para entender melhor como voce esta se sentindo e encaminhar suas informacoes para o medico. Pode comecar me contando o que esta sentindo?
```

This can be personalized per session using overrides or dynamic variables:

```
Ola {{patient_name}}! Sou o assistente de triagem virtual...
```

### 4.3 Language Configuration

ElevenLabs agents support **automatic language detection** across 32+ languages, including Portuguese (pt-BR). The agent automatically detects the user's language from speech and responds accordingly.

For a medical application, we should:
1. Set the system prompt in Portuguese to anchor the agent's language
2. Set the first message in Portuguese
3. Select a Portuguese-capable voice (ElevenLabs has 3,000+ voices including pt-BR options)

There is no explicit "language lock" setting, but the combination of pt-BR system prompt + pt-BR first message + pt-BR voice effectively locks the conversation to Portuguese.

### 4.4 Turn Detection and Conversation Flow

Configurable settings in the agent's Advanced tab:

| Setting | Description | Range | Recommended for Medical |
|---------|-------------|-------|------------------------|
| **Turn timeout** | Silence before agent prompts | 1-30 seconds | 8-10 seconds (patients need time to think) |
| **Turn eagerness** | How quickly agent responds | Eager / Normal / Patient | **Patient** (wait for patient to finish) |
| **Interruption** | Whether patient can interrupt agent | Enable/Disable | **Enable** (patient safety -- e.g., "wait, I also have chest pain") |

**Turn eagerness** is particularly important for medical conversations:
- **Eager:** Agent responds quickly -- may cut off patients mid-thought
- **Normal:** Balanced turn-taking
- **Patient:** Agent waits longer before taking its turn -- best for medical interviews where patients describe symptoms with pauses

### 4.5 Maximum Conversation Duration

ElevenLabs does NOT appear to have a hard maximum conversation duration (unlike OpenAI Realtime API's 60-minute limit). The conversation runs until:
- The agent calls `end_call`
- The client calls `endSession()`
- The connection drops
- The configured silence timeout triggers

**For medical triage:** This is a significant advantage over the OpenAI Realtime API. Complex medical histories can run longer than 60 minutes without hitting a session limit.

**Confidence: MEDIUM** -- No explicit documentation of a maximum session duration. Should be verified with ElevenLabs support.

### 4.6 Mid-Conversation Behavior Changes

The agent's behavior can be influenced mid-conversation through:

1. **Tool return values:** When `check_emergency()` returns `{ urgency: "emergency" }`, the agent receives this and adjusts behavior based on system prompt instructions
2. **Contextual updates:** `conversation.sendContextualUpdate("Patient's heart rate is elevated based on wearable data. Prioritize cardiovascular questions.")` -- informs the agent without triggering a response
3. **Dynamic prompts via overrides at session start** -- cannot change the system prompt mid-conversation, but contextual updates serve a similar purpose

**Confidence: HIGH** -- Documented in SDK reference.

---

## 5. Transcript & Data Extraction

### 5.1 Real-Time Transcript Streaming

The `onMessage` callback provides real-time transcript updates:

```typescript
onMessage: ({ message, source }) => {
  // source: "ai" | "user"
  // message: string (can be tentative or final transcription)
  addToTranscript({ role: source, text: message, timestamp: Date.now() });
}
```

**Important:** Not all client events are enabled by default. The `onMessage` callback requires the corresponding event to be enabled in the agent's "Advanced" tab in the ElevenLabs dashboard.

Message types include:
- **Tentative user transcription** -- partial, may change
- **Final user transcription** -- complete utterance
- **Agent response** -- LLM-generated text
- **Debug messages** (if debug mode enabled)

### 5.2 Full Transcript After Conversation

After the conversation ends, the full transcript is available via:

#### A. GET Conversation Details API

```
GET https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}
```

Response includes:
- `transcript` -- List of message objects with properties for role, text, timestamps
- `status` -- `initiated` | `in-progress` | `processing` | `done` | `failed`
- `analysis` -- Extracted data and evaluation results (if configured)
- `has_audio`, `has_user_audio`, `has_response_audio` -- Audio availability flags

#### B. Post-Call Webhook

ElevenLabs fires a webhook when the call ends and processing is complete. Three webhook types:

| Webhook Type | Data Included |
|-------------|---------------|
| `post_call_transcription` | Full transcript, analysis results, metadata |
| `post_call_audio` | Base64-encoded audio of the full conversation |
| `call_initiation_failure` | Failure reasons and metadata |

The `post_call_transcription` webhook is ideal for our use case:

```typescript
// app/api/webhooks/elevenlabs/route.ts
export async function POST(request: Request) {
  // Verify HMAC signature
  const signature = request.headers.get("ElevenLabs-Signature");
  const body = await request.text();
  if (!verifyHmacSignature(body, signature, process.env.ELEVENLABS_WEBHOOK_SECRET!)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const data = JSON.parse(body);
  const { conversation_id, transcript, analysis } = data;

  // Save full transcript and analysis to Supabase
  const supabase = createServiceRoleClient();
  await supabase.from("consultations").update({
    full_transcript: transcript,
    ai_analysis: analysis,
    status: "awaiting_doctor_review",
  }).eq("elevenlabs_conversation_id", conversation_id);

  return Response.json({ received: true }, { status: 200 });
}
```

### 5.3 Data Collection / Conversation Analysis

ElevenLabs provides built-in **Data Collection** that uses LLM analysis to extract structured information from conversation transcripts. This is configured in the agent settings and runs automatically after each conversation.

For our medical triage use case, we can configure extraction of:
- Chief complaint
- Symptom list with severity and duration
- Past medical history
- Medication list
- Allergy list
- Urgency classification
- Key quotes from the patient

Extracted data is available in:
- The `analysis` field of the GET Conversation API response
- The `post_call_transcription` webhook payload

### 5.4 Audio Recording

Audio saving is configurable per-agent in Privacy Settings:
- **Enable:** Save call audio for later review (accessible via API)
- **Disable:** Audio is not retained after the conversation

For LGPD compliance and CFM requirements (20-year medical record retention), we should:
1. Enable audio saving on the ElevenLabs side
2. Download the audio via webhook or API after each conversation
3. Store it in our own encrypted storage (Supabase Storage or similar)
4. Configure ElevenLabs retention to minimum (since we have our own copy)

**Confidence: HIGH** -- Verified from API reference, webhook documentation, and data collection docs.

### 5.5 Triggering Post-Conversation Processing

The flow for post-conversation summary generation:

```
1. Agent calls end_call system tool
2. ElevenLabs ends the conversation
3. ElevenLabs runs data extraction / analysis
4. ElevenLabs fires post_call_transcription webhook
5. Our webhook handler receives: transcript + analysis + metadata
6. Our handler saves to Supabase
7. Our handler triggers summary generation (optional: call GPT-4o for a more detailed clinical summary)
8. Consultation status updated to "awaiting_doctor_review"
```

This replaces the need for a custom post-conversation processing pipeline. However, for more sophisticated clinical summaries (Phase 5), we may still want to run an additional LLM pass using GPT-4o with a specialized clinical summary prompt, using the extracted transcript as input.

---

## 6. Revised Architecture Diagram

### 6.1 Previous Architecture (Composed Pipeline)

```
Browser                    Custom WS Server           External Services
------                     ----------------           -----------------
[getUserMedia]
     |
[AudioWorklet 16kHz PCM]
     |
[@ricky0123/vad-web]
     |
[WebSocket Client] ------> [ws-audio-server.ts] ----> [Deepgram STT]
                            [Port 3001]                     |
                                 |                     [text transcript]
                                 |                          |
                            [LLM Orchestrator] -------> [OpenAI GPT-4o-mini]
                                 |                          |
                            [TTS Proxy] ----------------> [OpenAI TTS / ElevenLabs]
                                 |                          |
[AudioPlaybackQueue] <----  [Stream audio back]        [audio chunks]
     |
[AudioContext.destination]
     |
[Speaker]

Components to build: 8+
Deployment: Vercel (Next.js) + VPS (WebSocket server) -- TWO deployment targets
```

### 6.2 New Architecture (ElevenLabs Centralized)

```
Browser                         ElevenLabs Cloud              Our Backend (Vercel)
------                          ----------------              --------------------
[User clicks "Iniciar"]
     |
[fetch /api/signed-url] ---------------------------------> [Route Handler]
     |                                                      [Verify Supabase JWT]
     |                                                      [Request signed URL]
[Receive signed URL] <---------------------------------------- [Return URL]
     |
[@elevenlabs/react SDK]
[useConversation hook]
     |
[startSession(signedUrl)] --------> [ElevenLabs Agent]
     |                              [STT (built-in)]
     |                              [VAD (built-in)]
[WebRTC audio stream] <-----------> [LLM (configurable)]
     |                              [TTS (built-in)]
     |                              [Echo cancellation]
     |                                    |
     |                              [Tool call: save_symptom]
[clientTools callback] <---------        |
     |                              [Tool call: end_consultation]
[fetch /api/save-symptom] --------------------------------> [Route Handler]
     |                                                      [Write to Supabase]
     |                                    |
[onMessage callback]              [Conversation ends]
[Display transcript]                     |
     |                              [Data extraction]
     |                              [Post-call webhook]
     |                                    |
     |                              [POST /api/webhooks] -> [Route Handler]
     |                                                      [Save transcript]
     |                                                      [Update consultation]
     |                                                      [Supabase write]

Components to build: 3-4 Route Handlers + 1 React component
Deployment: Vercel ONLY -- single deployment target
```

### 6.3 What We NO LONGER Need to Build

| Component | Reason Eliminated |
|-----------|------------------|
| Custom WebSocket server (`ws-audio-server.ts`) | Browser connects directly to ElevenLabs |
| AudioWorklet PCM processor | SDK handles mic capture internally |
| `@ricky0123/vad-web` integration + Silero ONNX | VAD runs on ElevenLabs server |
| Custom audio playback queue | SDK handles audio playback |
| Custom barge-in / interruption logic | Platform-level configuration |
| WebSocket reconnection with exponential backoff | SDK handles reconnection |
| LLM orchestration server | ElevenLabs orchestrates LLM calls |
| TTS proxy server | ElevenLabs handles TTS internally |
| 16kHz resampling pipeline | Not needed (SDK handles audio format) |
| Echo cancellation workarounds | WebRTC provides built-in AEC |
| Separate deployment target (VPS for WS server) | Everything on Vercel |

### 6.4 What We STILL Need to Build

| Component | Purpose | Complexity |
|-----------|---------|------------|
| **Signed URL Route Handler** | `/api/elevenlabs/signed-url` -- authenticate user, generate signed URL | Low |
| **Client tool handlers** | `/api/triage/save-symptom`, `/api/triage/emergency-check` -- Supabase writes | Low |
| **Post-call webhook handler** | `/api/webhooks/elevenlabs` -- receive transcript, save to Supabase | Medium |
| **React triage component** | Voice interface with `useConversation` hook, transcript display, emergency UI | Medium |
| **ElevenLabs agent configuration** | System prompt, tools, voice selection, conversation flow settings | Medium |
| **Consultation lifecycle management** | Create consultation on start, update on end, status management | Medium |
| **Consent verification** | Ensure LGPD consent exists before starting triage | Low (already in Phase 2) |
| **Summary generation (Phase 5)** | Additional LLM pass for detailed clinical summary using extracted transcript | Medium |

### 6.5 Where Authentication Happens

```
1. User logs in via Supabase Auth (existing Phase 1 flow)
2. User navigates to /patient/triage (protected by proxy.ts middleware)
3. Consent verified (Phase 2 consent gating)
4. Client requests signed URL from /api/elevenlabs/signed-url
5. Route Handler verifies Supabase session cookie / JWT
6. Route Handler requests signed URL from ElevenLabs API (using server-side API key)
7. Client receives signed URL and starts conversation
8. During conversation: client tools call our API routes (authenticated via Supabase session)
9. Server tools called by ElevenLabs: authenticated via bearer token / HMAC
10. Post-call webhook: authenticated via HMAC signature verification
```

### 6.6 Data Flow for a Complete Triage Session

```
1. PREPARATION
   Patient logs in -> Consent verified -> "Iniciar Triagem" button shown
   Client creates consultation record in Supabase (status: "initiated")

2. CONNECTION
   Client -> GET /api/elevenlabs/signed-url (with Supabase JWT)
   Server -> Verify JWT, request signed URL from ElevenLabs
   Server -> Return signed URL to client
   Client -> startSession(signedUrl, overrides: { patient context })

3. CONVERSATION (5-30 minutes)
   Patient speaks -> ElevenLabs STT -> LLM processes -> TTS responds -> Patient hears
   Real-time: onMessage callbacks update transcript display
   Tool calls: save_symptom() saves to Supabase mid-conversation
   Tool calls: check_emergency() evaluates urgency
   Contextual updates: previous medical history injected as needed

4. COMPLETION
   Agent calls end_call (or patient clicks "Encerrar")
   ElevenLabs processes transcript and runs data extraction

5. POST-PROCESSING
   ElevenLabs fires post_call_transcription webhook
   Webhook handler saves full transcript to Supabase
   Webhook handler updates consultation status to "awaiting_doctor_review"
   (Phase 5: Additional GPT-4o pass generates detailed clinical summary)

6. DOCTOR REVIEW (Phase 6)
   Doctor sees new consultation in queue, ordered by urgency
   Doctor reviews AI summary, transcript, extracted symptoms
   Doctor contacts patient if needed
```

---

## 7. Deployment Implications

### 7.1 Does This Solve the Vercel Deployment Problem?

**YES.** This was the single biggest architectural problem identified in the Research Review (Section 2.6, "Deployment Architecture vs Vercel -- Fundamental Conflict"). With ElevenLabs centralized:

- No custom WebSocket server needed
- No persistent connections from our infrastructure
- All our backend code runs as Vercel serverless Route Handlers
- Single deployment target: `vercel deploy`

The browser establishes a WebRTC/WebSocket connection directly to ElevenLabs infrastructure, completely bypassing our server for voice transport.

### 7.2 Infrastructure Required

| Component | Provider | Purpose |
|-----------|----------|---------|
| **Next.js App** | Vercel | Frontend + Route Handlers |
| **Database + Auth** | Supabase | PostgreSQL, Auth, RLS |
| **Voice AI Agent** | ElevenLabs | STT + LLM + TTS + VAD |
| **Nothing else** | -- | No VPS, no containers, no WebSocket server |

### 7.3 CORS and Domain Configuration

- **ElevenLabs SDK connections:** The SDK connects directly to ElevenLabs servers, so no CORS configuration is needed on our end for voice transport.
- **ElevenLabs domain allowlist:** For additional security, configure the allowed origin domains in ElevenLabs agent settings (e.g., `https://triagemvirtual.vercel.app`).
- **Server tool endpoints:** ElevenLabs calls our Route Handlers from their servers. Standard Vercel serverless functions handle this without special CORS config (it is server-to-server, not browser-to-server).
- **Webhook endpoints:** Same as server tools -- server-to-server requests.

### 7.4 Environment Variables

```env
# .env.local

# Existing (Phase 1-2)
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<supabase-anon-key>

# New for ElevenLabs (Phase 3)
ELEVENLABS_API_KEY=<elevenlabs-api-key>          # Server-side only, NEVER expose
ELEVENLABS_AGENT_ID=<agent-id>                   # Can be public or server-side
ELEVENLABS_WEBHOOK_SECRET=<webhook-hmac-secret>  # For verifying webhook signatures
ELEVENLABS_TOOL_SECRET=<tool-bearer-token>       # For authenticating server tool calls
```

Note: `ELEVENLABS_API_KEY` does NOT have a `NEXT_PUBLIC_` prefix. It must remain server-side only.

### 7.5 Vercel Integration

ElevenLabs has an official Vercel integration available in the Vercel Marketplace. It automatically provisions the `ELEVENLABS_API_KEY` environment variable in your Vercel project.

**Confidence: HIGH** -- Verified from Vercel marketplace documentation.

---

## 8. Migration Path and Vendor Lock-In Assessment

### 8.1 Coupling Analysis

| Component | Coupling Level | Portability |
|-----------|---------------|-------------|
| **System prompt** | LOW | Plain text, portable to any LLM platform |
| **Tool definitions** | LOW | JSON schema, maps to OpenAI function calling format |
| **Voice selection** | MEDIUM | ElevenLabs voice IDs are proprietary, but voice characteristics can be replicated |
| **SDK integration** | HIGH | `@elevenlabs/react` hooks are ElevenLabs-specific |
| **Conversation analysis config** | MEDIUM | Extraction rules can be reimplemented |
| **Post-call webhooks** | LOW | Standard HTTP webhooks, portable |
| **Signed URL auth flow** | MEDIUM | Pattern is common but implementation differs per provider |

### 8.2 What Is Portable

1. **System prompt** -- The medical anamnesis instructions are pure text. They work with any LLM (OpenAI, Anthropic, Google).
2. **Tool definitions** -- The tool names, descriptions, and parameter schemas follow the OpenAI function calling format, which ElevenLabs uses as its standard. These port directly to OpenAI API, Anthropic API, or any OpenAI-compatible platform.
3. **Backend API routes** -- Our Route Handlers for Supabase integration (`/api/triage/save-symptom`, etc.) are independent of ElevenLabs. They accept JSON, write to Supabase, return JSON.
4. **Conversation flow logic** -- The anamnesis protocol, emergency detection, and consultation lifecycle are in our code and prompts, not locked to ElevenLabs.

### 8.3 What Is NOT Portable

1. **`@elevenlabs/react` SDK** -- The `useConversation()` hook and its callbacks are ElevenLabs-specific. Switching to another platform (LiveKit, Vapi, custom WebSocket) requires rewriting the client-side voice component.
2. **ElevenLabs agent configuration** -- The dashboard-configured agent (voice, conversation flow settings, turn detection, knowledge base) would need to be recreated.
3. **WebRTC connection handling** -- If migrating to a non-WebRTC platform, additional infrastructure would be needed.

### 8.4 Migration Effort Estimate

| Migration Target | Effort | What Changes |
|-----------------|--------|-------------|
| **LiveKit + custom STT/TTS** | 2-3 weeks | New client SDK, LiveKit agent server (Python), audio pipeline rebuild |
| **Vapi.ai** | 1 week | Different SDK, similar tool concepts, vendor swap |
| **OpenAI Realtime API** | 1-2 weeks | WebRTC client code, ephemeral token flow, no server tools (client-side only) |
| **Custom WebSocket pipeline** | 3-4 weeks | Full rebuild of audio capture, streaming, VAD, playback |

### 8.5 Risk Mitigation Recommendations

1. **Keep all business logic in our codebase** -- System prompts, tool implementations, and consultation management should live in our Next.js app, not solely in ElevenLabs dashboard configuration.
2. **Version control agent configuration** -- Export the ElevenLabs agent configuration (via API) and store it in our repository for reproducibility.
3. **Abstract the voice interface** -- Create a React component abstraction (`<TriageVoiceAgent>`) that encapsulates the ElevenLabs SDK. If we switch providers, only this component changes.
4. **Use the ElevenLabs API (not just the dashboard)** -- Configure the agent programmatically via API so the configuration is reproducible and version-controlled.

**Confidence: MEDIUM** -- Migration estimates are approximate and depend on team familiarity with target platforms.

---

## 9. Pricing Considerations

### 9.1 ElevenLabs Agents Pricing

| Plan | Included Minutes | Price/Minute (Overage) | Monthly Cost |
|------|-----------------|----------------------|-------------|
| Creator | 250 min | $0.10/min | ~$22/mo |
| Pro | 1,100 min | $0.10/min | ~$99/mo |
| Scale | 3,600 min | varies | ~$330/mo |
| Business (annual) | up to 13,750 min | $0.08/min | ~$1,320/mo |

### 9.2 Cost Comparison: ElevenLabs vs Composed Pipeline

| Scenario | ElevenLabs ($0.10/min) | Composed Pipeline ($0.014/min) | Difference |
|----------|----------------------|-------------------------------|-----------|
| 10 min conversation | $1.00 | $0.14 | 7.1x more expensive |
| 100 conversations/mo (10 min each) | $100 | $14 | +$86/mo |
| 1,000 conversations/mo | $1,000 | $140 | +$860/mo |
| 10,000 conversations/mo | $10,000 | $1,400 | +$8,600/mo |

### 9.3 Total Cost of Ownership Comparison

However, the composed pipeline has hidden costs that narrow the gap:

| Cost Factor | ElevenLabs | Composed Pipeline |
|-------------|-----------|------------------|
| Voice minutes | $0.10/min | $0.014/min |
| VPS for WebSocket server | $0 | $20-100/mo |
| Engineering time (build) | ~1-2 weeks | ~4-6 weeks |
| Engineering time (maintain) | Minimal | Significant (custom infra) |
| Debugging voice issues | ElevenLabs support | Self-service |
| Scaling infrastructure | Managed | Self-managed |
| iOS Safari AEC issues | Handled by WebRTC | Custom workarounds needed |

**For an MVP/early-stage product with < 1,000 conversations/month**, ElevenLabs is likely more cost-effective when accounting for engineering time savings.

**At scale (10,000+ conversations/month)**, the per-minute cost difference becomes significant, and building a custom pipeline may be justified.

---

## 10. LGPD and Privacy Considerations

### 10.1 ElevenLabs Data Handling

| Setting | Options | Recommendation |
|---------|---------|---------------|
| **Data retention** | 0 days to 2 years (default: 2 years) | Set to minimum needed for debugging |
| **Audio saving** | Enable/Disable per agent | Enable, download via webhook, then store in our infrastructure |
| **Data residency** | US (default), EU (Enterprise) | US for standard plans; evaluate EU residency for LGPD |
| **Zero retention mode** | Enterprise only | Ideal for LGPD but requires Enterprise plan |

### 10.2 LGPD Compliance Gaps

1. **Data residency:** Standard ElevenLabs plans process data in the US. LGPD allows international transfer with adequate protection (Art. 33), but this requires a DPA and standard contractual clauses. ElevenLabs provides a DPA document.
2. **Audio retention:** Even with 0-day retention on ElevenLabs, audio traverses their servers during the conversation. The processing itself constitutes data handling under LGPD.
3. **Third-party LLM:** If using ElevenLabs-hosted LLMs, patient data goes to ElevenLabs. If using a custom LLM (e.g., pointing to OpenAI directly), data also flows to OpenAI. Both require DPAs.
4. **Consent specificity:** The LGPD consent (Phase 2) must specifically mention that voice data is processed by ElevenLabs (a third-party service based in the US).

### 10.3 Recommendations

- Sign the ElevenLabs DPA
- Update the patient consent form to explicitly mention ElevenLabs as a data processor
- Set retention to minimum (0 days if possible)
- Download audio and transcript via webhook immediately after each conversation
- Store our copy in Supabase Storage with encryption at rest
- Document the complete data flow for LGPD compliance records (RIPD)

---

## Recommendations

### PRIMARY RECOMMENDATION: Adopt ElevenLabs Conversational AI

**Rationale:**
1. **Eliminates the Vercel deployment conflict** -- the single biggest architectural risk identified in Research Review
2. **Eliminates 80% of Phase 3 custom development** -- no AudioWorklet, no WebSocket server, no VAD integration, no audio playback queue
3. **Solves iOS Safari echo cancellation** -- WebRTC AEC is battle-tested across billions of calls
4. **Custom tools enable Supabase integration** -- function calling during conversation saves symptoms, checks emergencies, finalizes consultations
5. **Post-call webhooks handle data persistence** -- full transcript and analysis delivered to our backend automatically
6. **Single deployment target** -- Vercel only, no VPS management
7. **Production-grade infrastructure** -- ElevenLabs handles scaling, reconnection, and audio quality

**Trade-offs accepted:**
1. Higher per-minute cost (~7x more than composed pipeline at list price)
2. Moderate vendor lock-in (client SDK is ElevenLabs-specific)
3. Data processing by US-based third party (LGPD implications)
4. Less control over individual pipeline components (STT, LLM, TTS)

### SECONDARY RECOMMENDATION: Phase 3 + 4 Merger

With ElevenLabs handling STT + LLM + TTS + VAD, Phase 3 (Voice Interface) and Phase 4 (Conversational Agent LLM) effectively merge into a single phase:
- The LLM is configured within the ElevenLabs agent (system prompt, tools)
- The voice interface IS the conversation -- they are not separate components
- Estimated development time: **1-2 weeks** instead of the original 4-6 weeks for Phase 3 + Phase 4 combined

### IMPLEMENTATION ORDER

1. Create ElevenLabs account and configure agent (system prompt, voice, tools)
2. Implement `/api/elevenlabs/signed-url` Route Handler
3. Build `<TriageVoiceAgent>` React component with `useConversation` hook
4. Implement client tools (save_symptom, check_emergency)
5. Implement server tools (end_consultation) or handle via client tools + our API
6. Implement post-call webhook handler
7. Integrate with existing consultation lifecycle (Supabase)
8. Test with pt-BR speakers, iterate on system prompt and tool definitions

---

## Open Questions

1. **Maximum conversation duration:** ElevenLabs docs do not specify a hard limit. Does a 30-minute medical history conversation work without disconnection? Needs testing.

2. **pt-BR medical terminology accuracy:** How well does ElevenLabs' built-in STT handle Portuguese medical terms like "dispneia", "precordialgia", "cefaleia"? Which STT model does ElevenLabs use internally? Can we configure the STT component?

3. **LLM selection for tool calling:** ElevenLabs supports GPT-4o, Claude Sonnet, Gemini, and custom LLMs. Which performs best for Portuguese medical anamnesis with reliable tool calling? Needs A/B testing.

4. **Latency in Brazil:** What is the round-trip latency from a Brazilian user to ElevenLabs servers (US-based)? Does the `serverLocation` parameter help? Options include "us", "eu-residency", "in-residency", "global".

5. **Bundle size verification:** The `@elevenlabs/react` package size should be measured with `next/bundle-analyzer` to ensure it does not significantly impact page load time.

6. **ElevenLabs DPA for LGPD:** Does the ElevenLabs DPA cover LGPD requirements for health data processing? Need to review the actual document.

7. **Audio download reliability:** The `post_call_audio` webhook delivers base64-encoded audio. What is the maximum file size? Is there a separate API for downloading audio? What if the webhook delivery fails?

8. **Custom STT within ElevenLabs:** Can we specify which STT model ElevenLabs uses internally (e.g., force Deepgram with keyterm prompting for medical terms)? Or is the STT model fixed?

9. **Cost at scale negotiation:** At 10,000+ conversations/month, can ElevenLabs negotiate custom pricing below $0.08/min? Enterprise pricing is not publicly listed.

10. **Conversation recovery after disconnect:** If a WebRTC connection drops mid-conversation, can the patient reconnect to the same conversation with context preserved? Or does a new session start from scratch?

---

## Sources

### ElevenLabs Official Documentation
- [Agents Platform Overview](https://elevenlabs.io/docs/agents-platform/overview) -- Platform capabilities and architecture
- [React SDK](https://elevenlabs.io/docs/agents-platform/libraries/react) -- `useConversation` hook API reference
- [JavaScript SDK](https://elevenlabs.io/docs/agents-platform/libraries/java-script) -- Client SDK API reference
- [Client Tools](https://elevenlabs.io/docs/agents-platform/customization/tools/client-tools) -- Client-side tool implementation
- [Server Tools](https://elevenlabs.io/docs/agents-platform/customization/tools/server-tools) -- Server-side webhook tools
- [System Tools](https://elevenlabs.io/docs/agents-platform/customization/tools/system-tools) -- End call, skip turn, transfer
- [End Call Tool](https://elevenlabs.io/docs/agents-platform/customization/tools/system-tools/end-call) -- Programmatic call termination
- [Agent Authentication](https://elevenlabs.io/docs/agents-platform/customization/authentication) -- Signed URLs and domain allowlists
- [Dynamic Variables](https://elevenlabs.io/docs/agents-platform/customization/personalization/dynamic-variables) -- Runtime value injection
- [Overrides](https://elevenlabs.io/docs/agents-platform/customization/personalization/overrides) -- Per-session configuration overrides
- [Conversation Flow](https://elevenlabs.io/docs/agents-platform/customization/conversation-flow) -- Turn detection, timeouts, interruption
- [Post-Call Webhooks](https://elevenlabs.io/docs/agents-platform/workflows/post-call-webhooks) -- Transcript and audio delivery
- [Conversation Analysis](https://elevenlabs.io/docs/agents-platform/customization/agent-analysis) -- Data extraction configuration
- [Data Collection](https://elevenlabs.io/docs/conversational-ai/customization/agent-analysis/data-collection) -- Structured data extraction
- [Knowledge Base](https://elevenlabs.io/docs/agents-platform/customization/knowledge-base) -- Domain-specific information
- [Models](https://elevenlabs.io/docs/agents-platform/customization/llm) -- LLM selection (GPT-4o, Claude, Gemini, custom)
- [Custom LLM Integration](https://elevenlabs.io/docs/agents-platform/customization/llm/custom-llm) -- Bring your own LLM
- [Prompting Guide](https://elevenlabs.io/docs/agents-platform/best-practices/prompting-guide) -- System prompt best practices
- [Privacy Settings](https://elevenlabs.io/docs/agents-platform/customization/privacy) -- Data retention and audio saving
- [Retention](https://elevenlabs.io/docs/agents-platform/customization/privacy/retention) -- Retention period configuration
- [Audio Saving](https://elevenlabs.io/docs/agents-platform/customization/privacy/audio-saving) -- Audio recording toggle
- [Data Residency](https://elevenlabs.io/docs/overview/administration/data-residency) -- EU residency for Enterprise
- [Webhooks](https://elevenlabs.io/docs/overview/administration/webhooks) -- HMAC signature verification

### ElevenLabs API Reference
- [Get Signed URL](https://elevenlabs.io/docs/conversational-ai/api-reference/conversations/get-signed-url) -- Signed URL generation endpoint
- [Get Conversation Details](https://elevenlabs.io/docs/api-reference/conversations/get) -- Transcript retrieval API
- [List Conversations](https://elevenlabs.io/docs/api-reference/conversations/list) -- Conversation listing API
- [API Authentication](https://elevenlabs.io/docs/api-reference/authentication) -- API key usage
- [Create Single Use Token](https://elevenlabs.io/docs/api-reference/tokens/create) -- Ephemeral token for WebRTC

### ElevenLabs Blog and Guides
- [Conversational AI WebRTC Support](https://elevenlabs.io/blog/conversational-ai-webrtc) -- WebRTC vs WebSocket comparison
- [How to Prompt a Conversational AI System](https://elevenlabs.io/blog/how-to-prompt-a-conversational-ai-system) -- Prompting best practices
- [ElevenLabs-Hosted LLMs](https://elevenlabs.io/blog/elevenlabs-hosted-llms) -- Hosted LLM announcement
- [Conversational AI 2.0](https://elevenlabs.io/blog/conversational-ai-2-0) -- Platform upgrade details
- [Pricing Update](https://elevenlabs.io/blog/we-cut-our-pricing-for-conversational-ai) -- Pricing reduction announcement

### ElevenLabs Quickstarts and Examples
- [Next.js Quickstart](https://elevenlabs.io/docs/agents-platform/guides/quickstarts/next-js) -- Official Next.js integration guide
- [Next.js Conversational AI Guide](https://elevenlabs.io/docs/conversational-ai/guides/conversational-ai-guide-nextjs) -- Detailed Next.js tutorial
- [Post-Call Webhooks with Next.js](https://elevenlabs.io/docs/cookbooks/agents-platform/post-call-webhooks) -- Webhook implementation cookbook
- [Chat Mode](https://elevenlabs.io/docs/agents-platform/guides/chat-mode) -- Text-only conversation mode

### GitHub Repositories
- [elevenlabs/packages](https://github.com/elevenlabs/packages) -- Official SDK source code (TypeScript)
- [elevenlabs/elevenlabs-examples](https://github.com/elevenlabs/elevenlabs-examples) -- Example implementations
- [leonvanzyl/elevenlabs-nextjs-conversational-ai](https://github.com/leonvanzyl/elevenlabs-nextjs-conversational-ai) -- Community Next.js example
- [ASHR12/elevenlabs-conversational-ai-agents](https://github.com/ASHR12/elevenlabs-conversational-ai-agents) -- Community Next.js agents example

### NPM Packages
- [@elevenlabs/react](https://www.npmjs.com/package/@elevenlabs/react) -- React SDK (current, v0.13.0)
- [@elevenlabs/client](https://www.npmjs.com/package/@elevenlabs/client) -- Core client SDK
- [@11labs/react](https://www.npmjs.com/package/@11labs/react) -- Deprecated, replaced by @elevenlabs/react

### Pricing
- [ElevenLabs API Pricing](https://elevenlabs.io/pricing/api) -- Official pricing page
- [ElevenLabs Pricing Breakdown (FlexPrice)](https://flexprice.io/blog/elevenlabs-pricing-breakdown) -- Third-party analysis, 2026
- [ElevenLabs Pricing Guide (eesel.ai)](https://www.eesel.ai/blog/elevenlabs-pricing) -- Complete pricing breakdown, 2025
- [How Much Does ElevenLabs Agents Cost?](https://help.elevenlabs.io/hc/en-us/articles/29298065878929-How-much-does-ElevenLabs-Agents-formerly-Conversational-AI-cost) -- Official FAQ

### Privacy and Compliance
- [ElevenLabs Privacy Policy](https://elevenlabs.io/privacy-policy) -- Official privacy policy
- [ElevenLabs DPA](https://elevenlabs.io/dpa) -- Data Processing Addendum
- [Zero Retention Mode](https://elevenlabs.io/docs/developers/resources/zero-retention-mode) -- Enterprise zero retention

### Platform Integration
- [Vercel ElevenLabs Integration](https://vercel.com/docs/ai/elevenlabs) -- Official Vercel integration docs
- [ElevenLabs for Vercel (Marketplace)](https://vercel.com/marketplace/elevenlabs) -- Vercel Marketplace listing
- [Portuguese TTS Voices](https://elevenlabs.io/text-to-speech/portuguese) -- pt-BR voice catalog
