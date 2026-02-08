'use client'

import { useActionState } from 'react'
import { login } from './actions'

export default function LoginPage() {
  const initialState = { error: '' }
  const [state, formAction, isPending] = useActionState(login, initialState)

  return (
    <div className="bg-surface rounded-lg shadow-lg p-8">
      <h2 className="text-2xl font-semibold text-text-primary mb-6">
        Login
      </h2>

      <form action={formAction} className="space-y-4">
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
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {state.error && (
          <div className="text-danger text-sm">{state.error}</div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-primary text-white rounded-lg py-2 px-4 font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="text-center text-sm text-text-secondary mt-4">
          Não tem conta?{' '}
          <a href="/signup" className="text-primary hover:underline">
            Cadastre-se
          </a>
        </p>
      </form>
    </div>
  )
}
