'use client'

import { useState } from 'react'
import { updateConsultationStatus } from '@/app/doctor/consultation/[id]/actions'

interface StatusActionsProps {
  consultationId: string
  currentStatus: string
}

export function StatusActions({ consultationId, currentStatus }: StatusActionsProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStatusChange = async (newStatus: 'in_review' | 'contacted' | 'completed') => {
    setLoading(true)
    setError(null)

    const result = await updateConsultationStatus(consultationId, newStatus)

    if (result.error) {
      setError(result.error)
    }

    setLoading(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {currentStatus === 'waiting' && (
          <button
            onClick={() => handleStatusChange('in_review')}
            disabled={loading}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition disabled:opacity-50"
          >
            {loading ? 'Atualizando...' : 'Iniciar Revisao'}
          </button>
        )}

        {currentStatus === 'in_review' && (
          <>
            <button
              onClick={() => handleStatusChange('contacted')}
              disabled={loading}
              className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent/90 transition disabled:opacity-50"
            >
              {loading ? 'Atualizando...' : 'Marcar Contato'}
            </button>
            <button
              onClick={() => handleStatusChange('completed')}
              disabled={loading}
              className="bg-success text-white px-4 py-2 rounded-lg hover:bg-success/90 transition disabled:opacity-50"
            >
              {loading ? 'Atualizando...' : 'Finalizar'}
            </button>
          </>
        )}

        {currentStatus === 'contacted' && (
          <button
            onClick={() => handleStatusChange('completed')}
            disabled={loading}
            className="bg-success text-white px-4 py-2 rounded-lg hover:bg-success/90 transition disabled:opacity-50"
          >
            {loading ? 'Atualizando...' : 'Finalizar'}
          </button>
        )}

        {currentStatus === 'completed' && (
          <span className="text-success font-medium">Consulta finalizada</span>
        )}
      </div>

      {error && (
        <p className="text-danger text-sm">{error}</p>
      )}
    </div>
  )
}
