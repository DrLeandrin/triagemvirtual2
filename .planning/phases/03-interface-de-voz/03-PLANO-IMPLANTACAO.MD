## PRD técnico executável — Fase 3 (Voz) — checklist por arquivo (POC)

### Meta

Implementar triagem por **voz em tempo real (WebRTC)** com **transcrição ao vivo** e **UI de estados** (ouvindo/processando/falando), usando **ElevenLabs Agents + `@elevenlabs/react`**, sem pipeline manual.  

---

## 1) Variáveis de ambiente

**Arquivo:** `.env.local`

* `ELEVENLABS_API_KEY`
* `ELEVENLABS_AGENT_ID`
* (opcional) `ELEVENLABS_WEBHOOK_SECRET`

> A POC precisa de Signed URL/token efêmero para não vazar API key no client. 

---

## 2) Backend — Signed URL (obrigatório)

### 2.1 Rota

**Arquivo:** `app/api/elevenlabs/signed-url/route.ts`

**Tarefas**

* [ ] Validar sessão do usuário (Supabase) e role **patient**.
* [ ] Chamar endpoint da ElevenLabs para gerar `signedUrl` com `agent_id`.
* [ ] Retornar JSON `{ signedUrl }`.

**Base (referência pronta da pesquisa)**

* Método “Signed URL” e exemplo completo da rota Next.js: 

**Critério de pronto**

* `GET /api/elevenlabs/signed-url` retorna 200 e `signedUrl` válido com usuário autenticado; retorna 401/403 sem auth.

---

## 3) Frontend — componente de voz (obrigatório)

### 3.1 Componente

**Arquivo sugerido:** `components/triage/TriageVoice.tsx`

**Tarefas**

* [ ] Instalar/usar `@elevenlabs/react` e `useConversation`. 
* [ ] Botão **Iniciar triagem**:

  * [ ] `navigator.mediaDevices.getUserMedia({ audio: true })` antes de iniciar sessão (UX e compatibilidade). 
  * [ ] `fetch("/api/elevenlabs/signed-url")`
  * [ ] `conversation.startSession({ signedUrl, connectionType:"webrtc", overrides })` 
* [ ] Botão **Encerrar**:

  * [ ] `conversation.endSession()` 
* [ ] Transcrição em tempo real:

  * [ ] Registrar callback de mensagens (append em array e render). 
* [ ] Fallback se microfone negado:

  * [ ] iniciar `textOnly: true` (ou exibir modo texto). 

**Overrid(es) mínimos (POC)**

* [ ] Definir `firstMessage` (ex.: “Olá, vou fazer algumas perguntas…”) e prompt curto.
* [ ] Definir idioma pt-BR no agente (onde aplicável via overrides/Agent config).  

**Critério de pronto**

* Em navegador desktop: fala → transcrição aparece → resposta em áudio toca. 

---

## 4) Frontend — página de triagem (obrigatório)

### 4.1 Rota/página

**Arquivo sugerido:** `app/triage/page.tsx` (ou a rota equivalente do teu projeto)

**Tarefas**

* [ ] Renderizar `TriageVoice`.
* [ ] Exibir estados e transcript em layout simples.
* [ ] Guardar `conversation_id` (se disponível no SDK) em state para uso posterior.

**Critério de pronto**

* Página única “Triagem” funciona end-to-end sem depender de outras fases.

---

## 5) UI de estados (obrigatório)

### 5.1 Mapeamento de estados

**No componente:** `TriageVoice.tsx`

**Tarefas**

* [ ] Exibir `conversation.status` (texto cru) e um “status amigável”.
* [ ] Exibir “agente falando” usando `isSpeaking`. 
* [ ] Mapear:

  * **falando**: `isSpeaking === true`
  * **ouvindo**: sessão ativa e `isSpeaking === false`
  * **processando**: transição (heurística simples: sessão ativa + último evento foi “usuário terminou” até `isSpeaking` virar true)

**Critério de pronto**

* Durante conversa, o rótulo muda de forma coerente e previsível. 

---

## 6) Ajustes de turn-taking/VAD (config, obrigatório mas fora do código)

**Local:** painel/config do Agent na ElevenLabs

**Tarefas**

* [ ] Ajustar **turn eagerness** para não interromper paciente em pausas (anamnese). 
* [ ] Confirmar VAD server-side (padrão do Agents; não implementar VAD no client para POC). 

---

## 7) Webhook pós-chamada (opcional recomendado)

> Não é necessário para “conversa ao vivo”, mas reduz retrabalho e já prepara para a Fase 5 (resumo).

### 7.1 Endpoint

**Arquivo:** `app/api/webhooks/elevenlabs/route.ts`

**Tarefas**

* [ ] Validar assinatura HMAC (`ElevenLabs-Signature`) usando `ELEVENLABS_WEBHOOK_SECRET`.
* [ ] Processar evento `post_call_transcription` e extrair transcript/analysis.
* [ ] Persistir no Supabase: `conversation_id`, `patient_id`, `transcript`, `analysis`. 

**Critério de pronto**

* Após encerrar chamada, webhook chega e salva transcrição no banco.

---

## 8) Testes de aceitação (obrigatório)

### 8.1 Manual

* [ ] Chrome (desktop): conversa contínua, sem PTT, com transcrição e áudio. 
* [ ] Negar microfone: entra em fallback (modo texto) e não quebra o fluxo. 
* [ ] iOS/Safari (se aplicável): exige gesto do usuário → “Iniciar triagem” antes de tocar/usar áudio cobre. 

---

## 9) Definição de “Done” (Fase 3 concluída)

* Paciente fala e ouve em tempo real via WebRTC. 
* Transcrição aparece ao vivo na UI. 
* Estados visuais funcionam. 
* API key nunca vai para o client (Signed URL). 

---
