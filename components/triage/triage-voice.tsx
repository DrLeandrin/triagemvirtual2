'use client'

import { useConversation } from '@elevenlabs/react'
import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'

type TranscriptEntry = {
  role: 'user' | 'agent'
  text: string
}

type ConnectionState = 'idle' | 'requesting-mic' | 'connecting' | 'connected' | 'error'
type TriageState = 'idle' | 'conversation' | 'processing' | 'completed' | 'error'

interface ProcessResult {
  consultation_id: string
  status: 'processed' | 'saved_without_analysis'
  urgency?: string
}

const URGENCY_LABELS: Record<string, { label: string; className: string }> = {
  emergency: { label: 'Emergencia', className: 'bg-urgency-emergency text-white' },
  urgent: { label: 'Urgente', className: 'bg-urgency-urgent text-white' },
  less_urgent: { label: 'Pouco Urgente', className: 'bg-urgency-less-urgent text-white' },
  non_urgent: { label: 'Nao Urgente', className: 'bg-urgency-non-urgent text-white' },
}

export function TriageVoice({ patientName }: { patientName: string }) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [triageState, setTriageState] = useState<TriageState>('idle')
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null)
  const [micError, setMicError] = useState<string | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const startingRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const conversation = useConversation({
    onMessage: ({ role, message: text }) => {
      setTranscript((prev) => [
        ...prev,
        { role: role === 'user' ? 'user' : 'agent', text },
      ])
      scrollToBottom()
    },
    onConnect: () => {
      console.log('[Triage] Connected')
      setConnectionState('connected')
      setTriageState('conversation')
    },
    onDisconnect: (details) => {
      console.log('[Triage] Disconnected:', JSON.stringify(details, null, 2))
      startingRef.current = false
      setConnectionState('idle')
    },
    onError: (message, context) => {
      console.error('[Triage] Error:', message, context)
      startingRef.current = false
      setConnectionState('error')
    },
    onStatusChange: ({ status }) => {
      console.log('[Triage] Status changed:', status)
    },
    onDebug: (info) => {
      console.log('[Triage] Debug:', info)
    },
  })

  const startConversation = async () => {
    if (startingRef.current) return
    startingRef.current = true

    setMicError(null)
    setConnectionState('requesting-mic')
    setTriageState('idle')
    setProcessResult(null)
    setTranscript([])

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setMicError(
        'Nao foi possivel acessar o microfone. Verifique as permissoes do navegador e tente novamente.'
      )
      startingRef.current = false
      setConnectionState('error')
      return
    }

    setConnectionState('connecting')

    try {
      const response = await fetch('/api/elevenlabs/signed-url')
      if (!response.ok) {
        throw new Error('Failed to get signed URL')
      }
      const data = await response.json()
      const { signedUrl } = data
      console.log('[Triage] Got signed URL:', signedUrl ? `${signedUrl.substring(0, 60)}...` : 'MISSING')

      if (!signedUrl) {
        throw new Error('No signed URL returned')
      }

      console.log('[Triage] Starting session (no overrides)...')
      await conversation.startSession({ signedUrl })
    } catch (error) {
      console.error('[Triage] Failed to start session:', error)
      startingRef.current = false
      setConnectionState('error')
    }
  }

  const endConversation = async () => {
    await conversation.endSession()
    startingRef.current = false
    setConnectionState('idle')

    if (transcript.length === 0) {
      setTriageState('idle')
      return
    }

    setTriageState('processing')

    const formattedTranscript = transcript
      .map((entry) => `${entry.role === 'user' ? 'Paciente' : 'Assistente'}: ${entry.text}`)
      .join('\n')

    try {
      const response = await fetch('/api/triage/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: formattedTranscript }),
      })

      if (!response.ok) {
        throw new Error('Processing failed')
      }

      const result: ProcessResult = await response.json()
      setProcessResult(result)
      setTriageState('completed')
    } catch (error) {
      console.error('[Triage] Processing error:', error)
      setTriageState('error')
    }
  }

  const statusLabel = (): string => {
    if (connectionState === 'requesting-mic') return 'Solicitando microfone...'
    if (connectionState === 'connecting') return 'Conectando...'
    if (connectionState === 'connected' && conversation.isSpeaking) return 'Respondendo...'
    if (connectionState === 'connected') return 'Ouvindo...'
    return ''
  }

  const isActive = connectionState === 'connected' || connectionState === 'connecting'

  // Processing state
  if (triageState === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">Processando sua triagem...</h2>
          <p className="text-text-secondary">
            Estamos analisando a conversa para gerar o resumo clinico. Isso pode levar alguns segundos.
          </p>
        </div>
      </div>
    )
  }

  // Completed state
  if (triageState === 'completed' && processResult) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="h-16 w-16 bg-success/20 rounded-full flex items-center justify-center">
          <svg className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">Triagem enviada com sucesso!</h2>
          {processResult.urgency && URGENCY_LABELS[processResult.urgency] && (
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${URGENCY_LABELS[processResult.urgency].className}`}>
              {URGENCY_LABELS[processResult.urgency].label}
            </span>
          )}
          <p className="text-text-secondary">
            {processResult.status === 'processed'
              ? 'Um medico ira revisar suas informacoes em breve.'
              : 'Sua conversa foi salva e sera analisada em breve.'}
          </p>
        </div>
        <Link
          href="/patient/dashboard"
          className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition"
        >
          Voltar ao Inicio
        </Link>
      </div>
    )
  }

  // Error state (post-processing)
  if (triageState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="h-16 w-16 bg-danger/20 rounded-full flex items-center justify-center">
          <svg className="h-8 w-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">Erro ao processar triagem</h2>
          <p className="text-text-secondary">
            Ocorreu um erro ao salvar sua triagem. Por favor, tente novamente.
          </p>
        </div>
        <button
          onClick={() => {
            setTriageState('idle')
            setTranscript([])
          }}
          className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition"
        >
          Tentar Novamente
        </button>
      </div>
    )
  }

  // Conversation / idle state
  return (
    <div className="space-y-6">
      {/* Status indicator */}
      {connectionState !== 'idle' && connectionState !== 'error' && (
        <div className="flex items-center gap-3 bg-surface border border-border rounded-lg p-4">
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              connectionState === 'connected'
                ? conversation.isSpeaking
                  ? 'bg-accent animate-pulse'
                  : 'bg-success animate-pulse'
                : 'bg-warning animate-pulse'
            }`}
          />
          <span className="text-text-secondary font-medium">{statusLabel()}</span>
        </div>
      )}

      {/* Mic error state */}
      {micError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4">
          <p className="text-danger text-sm">{micError}</p>
        </div>
      )}
      {connectionState === 'error' && !micError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4">
          <p className="text-danger text-sm">
            Ocorreu um erro na conexao. Tente novamente.
          </p>
        </div>
      )}

      {/* Transcript */}
      <div className="bg-surface border border-border rounded-lg p-4 min-h-[300px] max-h-[500px] overflow-y-auto">
        {transcript.length === 0 ? (
          <p className="text-text-muted text-center py-12">
            {isActive
              ? 'A conversa vai aparecer aqui...'
              : 'Clique em "Iniciar Triagem" para comecar.'}
          </p>
        ) : (
          <div className="space-y-3">
            {transcript.map((entry, i) => (
              <div
                key={i}
                className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    entry.role === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-surface-secondary text-text-primary'
                  }`}
                >
                  <p className="text-xs font-medium mb-1 opacity-70">
                    {entry.role === 'user' ? 'Voce' : 'Assistente'}
                  </p>
                  <p className="text-sm">{entry.text}</p>
                </div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        {!isActive ? (
          <button
            onClick={startConversation}
            disabled={connectionState === 'requesting-mic'}
            className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Iniciar Triagem
          </button>
        ) : (
          <button
            onClick={endConversation}
            className="bg-danger text-white px-6 py-3 rounded-lg hover:bg-danger/90 transition"
          >
            Encerrar Conversa
          </button>
        )}
      </div>
    </div>
  )
}
