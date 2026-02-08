import Link from 'next/link'

export default function PatientDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Bem-vindo</h1>
        <p className="text-text-secondary mt-2">
          Sua saude e nossa prioridade. Inicie uma nova triagem quando precisar.
        </p>
      </div>

      <div>
        <Link
          href="/patient/triage"
          className="inline-block bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition"
        >
          Iniciar Triagem
        </Link>
      </div>

      <div className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Suas consultas recentes
        </h2>
        <p className="text-text-muted">Nenhuma consulta realizada ainda.</p>
      </div>
    </div>
  )
}
