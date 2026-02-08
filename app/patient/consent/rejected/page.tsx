import Link from 'next/link'

export default function ConsentRejectedPage() {
  return (
    <div className="max-w-lg mx-auto text-center">
      <div className="bg-surface rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-semibold text-text-primary mb-4">
          Consentimento Necessario
        </h1>
        <p className="text-text-secondary mb-6">
          Para utilizar o servico de triagem virtual, e necessario aceitar o
          termo de consentimento para coleta de dados de saude. Sem ele, nao
          podemos processar suas informacoes.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/patient/consent"
            className="bg-primary text-white py-3 px-6 rounded-lg font-medium hover:bg-primary-dark text-center"
          >
            Voltar e Aceitar
          </Link>
          <Link
            href="/login"
            className="text-text-secondary hover:text-text-primary text-sm"
          >
            Sair
          </Link>
        </div>
      </div>
    </div>
  )
}
