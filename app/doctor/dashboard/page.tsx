export default function DoctorDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Fila de Pacientes</h1>
        <p className="text-text-secondary mt-2">
          Pacientes aguardando revisao medica
        </p>
      </div>

      <div className="bg-surface border border-border rounded-lg p-6">
        <p className="text-text-muted">Nenhum paciente na fila no momento.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-text-muted">Carregando...</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-text-muted">Carregando...</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-text-muted">Carregando...</p>
        </div>
      </div>
    </div>
  )
}
