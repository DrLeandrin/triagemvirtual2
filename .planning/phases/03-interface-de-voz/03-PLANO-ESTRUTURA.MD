## Documento de implementação — Fase 3 (Voz) — Triagem Virtual v1 (POC)

### 0) Contexto do produto (para manter alinhamento)

O fluxo v1 é: paciente conversa por **voz em tempo real (sem PTT)** → sistema coleta história clínica → depois gera resumo para o médico. 
A Fase 3 existe para entregar **voz + transcrição em tempo real + UI de estados**. 

---

## 1) Objetivo e critérios de sucesso da Fase 3

### Objetivo

Paciente consegue **falar** e **ouvir** o agente **em tempo real**. 

### Entregáveis (o que vamos realmente construir agora)

* Captura de áudio (browser) via WebRTC (sem PTT) 
* STT + TTS integrados (para POC: via ElevenLabs Agents, sem pipeline manual) 
* VAD / detecção de silêncio (para POC: server-side da ElevenLabs) 
* Tela de triagem com estados **ouvindo / processando / falando** + transcrição em tempo real 

### Critérios de sucesso (checagem objetiva)

* Microfone captura áudio sem PTT 
* Fala transcrita em tempo real 
* Resposta reproduzida em áudio 
* UI exibe estado correto e não corta o paciente 

---

## 2) Decisão técnica para POC (mais rápida e menos frágil)

### Escolha: ElevenLabs Agents + `@elevenlabs/react` (WebRTC)

Motivo: o SDK usa **WebRTC por padrão**, com baixa latência e conexão direta do browser com a infraestrutura da ElevenLabs (sem precisar de servidor de áudio/streaming), o que é ideal para Vercel/Next.js. 
Além disso, evita baixar/rodar VAD no cliente, porque o VAD fica server-side. 

### Autenticação da sessão (não vazar API key)

Você vai emitir, via backend Next.js, um **Signed URL** (ou token efêmero) e iniciar a sessão no client. A pesquisa já define os dois métodos e o padrão de rota Next.js.  

---

## 3) Arquitetura mínima (POC)

### Componentes

1. **Frontend (página de triagem do paciente)**

* Botões: *Iniciar triagem* / *Encerrar*
* Indicadores: status da conversa + “agente falando” + (opcional) animação/avatar
* Painel: transcrição em tempo real (parcial e final)

2. **Backend (Next.js Route Handler)**

* `GET /api/elevenlabs/signed-url`

  * valida sessão Supabase + role patient (+ consent se já existir)
  * chama ElevenLabs “get-signed-url” mantendo API key no servidor 

3. **(Opcional, mas recomendado já) Webhook pós-chamada**

* `POST /api/webhooks/elevenlabs` para receber `post_call_transcription` e persistir transcrição/analysis. 

---

## 4) Fluxo do usuário (UI)

1. Paciente autenticado acessa “Triagem”.
2. Clique em **Iniciar triagem**:

   * pede permissão de microfone (`getUserMedia`) **antes** de iniciar a sessão (evita iOS/Safari e melhora UX) 
   * busca `signedUrl` no backend
   * chama `conversation.startSession({ signedUrl, connectionType: "webrtc", overrides: ... })` 
3. Durante a conversa:

   * UI mostra **ouvindo/processando/falando**
   * transcrição em tempo real via callback de mensagens (vide pesquisa) 
4. Clique em **Encerrar**:

   * `conversation.endSession()` 

**Fallback obrigatório para POC**: se usuário negar microfone → modo texto (`textOnly: true`). 

---

## 5) Implementação (passo a passo, direto ao ponto)

### 5.1 Variáveis de ambiente

* `ELEVENLABS_API_KEY`
* `ELEVENLABS_AGENT_ID`
* (opcional webhook) `ELEVENLABS_WEBHOOK_SECRET`

### 5.2 Backend — rota Signed URL

Criar `app/api/elevenlabs/signed-url/route.ts` seguindo o padrão já pesquisado:

* validar usuário Supabase
* validar role patient (e consent quando existir)
* chamar endpoint `.../get-signed-url?agent_id=...`
* retornar `{ signedUrl }` 

### 5.3 Frontend — componente de triagem por voz

Criar um componente (ex.: `TriageVoice.tsx`) usando `useConversation`, com:

* `startTriage()`: `getUserMedia` → fetch signedUrl → `startSession({ signedUrl, connectionType:"webrtc", overrides })` 
* `endTriage()`: `endSession()` 
* `onMessage`: append no array `transcript` e renderizar em tela (padrão já levantado). 

**Personalização mínima (POC)**: passar `firstMessage` + `prompt` e idioma pt-BR via overrides.  

### 5.4 UI de estados (mapeamento simples)

* `conversation.status` → exibir status textual e mapear para:

  * **ouvindo**: conectado e `!isSpeaking`
  * **falando**: `isSpeaking === true` 
  * **processando**: janelas entre final de fala e início de fala do agente (pode inferir por eventos; na POC, aceite um “estado intermediário” baseado em status/eventos)

### 5.5 VAD / fim de fala (sem cortar paciente)

Para POC, delegue a detecção de turnos ao Agents (server-side), e ajuste “turn eagerness” no painel da ElevenLabs para um comportamento mais paciente (ideal em anamnese). 

### 5.6 (Opcional recomendado) Webhook pós-chamada

Implemente `POST /api/webhooks/elevenlabs` com:

* verificação HMAC (`ElevenLabs-Signature`)
* extrair `conversation_id`, `transcript`, `analysis`
* persistir no Supabase vinculando à consulta 
  Isso já prepara o terreno para Fase 5 (resumo) sem retrabalho.

---

## 6) Esqueleto de código (mínimo necessário)

### 6.1 `GET /api/elevenlabs/signed-url`

Use como base o trecho pesquisado (já com validação Supabase e chamada ao endpoint). 

### 6.2 `TriageVoice.tsx` (idéia operacional)

* `await navigator.mediaDevices.getUserMedia({ audio: true })` 
* `const { signedUrl } = await (await fetch("/api/elevenlabs/signed-url")).json()` 
* `conversation.startSession({ signedUrl, connectionType:"webrtc", overrides: { ... }})` 
* Render transcript como no snippet pesquisado 

---

## 7) Testes de aceitação (checklist rápido)

* Chrome desktop: conversa por voz OK; transcrição aparece; áudio do agente toca; estados alternam. 
* Permissão negada: cai para `textOnly` e ainda permite triagem (MVP não quebra). 
* iOS Safari: exige gesto do usuário antes do áudio; fluxo “consentimento → iniciar triagem” cobre isso (se Fase 2 já estiver) 
* Pausas longas do paciente: agente não interrompe cedo (ajuste turn eagerness). 

---

## 8) O que **não** fazer agora (para não travar o MVP)

* Não implementar pipeline manual STT/TTS/VAD (Web Speech + Deepgram + ElevenLabs TTS) na Fase 3: isso aumenta superfície de bugs e tempo; o roadmap só exige a funcionalidade — não a implementação manual. 
* Não implementar persistência completa de áudio/transcrição no banco como “obrigatório” da Fase 3 (isso é naturalmente consumido na Fase 5), mas o webhook opcional já resolve quase tudo com pouco atrito.  
