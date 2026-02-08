'use client'

import { useActionState } from 'react'
import { signup } from './actions'

export default function SignupPage() {
  const initialState = { error: '', success: '' }
  const [state, formAction, isPending] = useActionState(signup, initialState)

  return (
    <div className="bg-surface rounded-lg shadow-lg p-8">
      <h2 className="text-2xl font-semibold text-text-primary mb-6">
        Criar Conta
      </h2>

      <form action={formAction} className="space-y-4">
        <div>
          <label
            htmlFor="fullName"
            className="block text-sm font-medium text-text-primary mb-1"
          >
            Nome completo
          </label>
          <input
            type="text"
            id="fullName"
            name="fullName"
            required
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label
            htmlFor="cpf"
            className="block text-sm font-medium text-text-primary mb-1"
          >
            CPF
          </label>
          <input
            type="text"
            id="cpf"
            name="cpf"
            required
            maxLength={14}
            placeholder="000.000.000-00"
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-text-primary mb-1"
          >
            E-mail
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-text-primary mb-1"
          >
            Senha
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            minLength={6}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-text-primary mb-1"
          >
            Confirmar senha
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            required
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {state.error && (
          <div className="text-danger text-sm">{state.error}</div>
        )}

        {state.success && (
          <div className="text-success text-sm">{state.success}</div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-primary text-white rounded-lg py-2 px-4 font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Criando conta...' : 'Criar conta'}
        </button>

        <p className="text-center text-sm text-text-secondary mt-4">
          Já tem conta?{' '}
          <a href="/login" className="text-primary hover:underline">
            Faça login
          </a>
        </p>
      </form>
    </div>
  )
}
