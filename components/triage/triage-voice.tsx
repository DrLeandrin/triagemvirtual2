'use client'

import { useConversation } from '@elevenlabs/react'
import { useCallback, useRef, useState } from 'react'

type TranscriptEntry = {
  role: 'user' | 'agent'
  text: string
}

type ConnectionState = 'idle' | 'requesting-mic' | 'connecting' | 'connected' | 'error'

export function TriageVoice({ patientName }: { patientName: string }) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [micError, setMicError] = useState<string | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

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
      setConnectionState('connected')
    },
    onDisconnect: () => {
      setConnectionState('idle')
    },
    onError: (message) => {
      console.error('ElevenLabs error:', message)
      setConnectionState('error')
    },
  })

  const startConversation = async () => {
    setMicError(null)
    setConnectionState('requesting-mic')

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setMicError(
        'Nao foi possivel acessar o microfone. Verifique as permissoes do navegador e tente novamente.'
      )
      setConnectionState('error')
      return
    }

    setConnectionState('connecting')

    try {
      const response = await fetch('/api/elevenlabs/signed-url')
      if (!response.ok) {
        throw new Error('Failed to get signed URL')
      }
      const { signedUrl } = await response.json()

      await conversation.startSession({
        signedUrl,
        overrides: {
          agent: {
            firstMessage: `Ola ${patientName}, eu sou o assistente de triagem virtual. Vou fazer algumas perguntas sobre como voce esta se sentindo para ajudar o medico a entender melhor o seu caso. Pode comecar me contando o que esta sentindo?`,
            language: 'pt',
          },
        },
      })
    } catch (error) {
      console.error('Failed to start session:', error)
      setConnectionState('error')
    }
  }

  const endConversation = async () => {
    await conversation.endSession()
    setConnectionState('idle')
  }

  const statusLabel = (): string => {
    if (connectionState === 'requesting-mic') return 'Solicitando microfone...'
    if (connectionState === 'connecting') return 'Conectando...'
    if (connectionState === 'connected' && conversation.isSpeaking) return 'Respondendo...'
    if (connectionState === 'connected') return 'Ouvindo...'
    return ''
  }

  const isActive = connectionState === 'connected' || connectionState === 'connecting'

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

      {/* Error state */}
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
