const URGENCY_CONFIG: Record<string, { label: string; className: string }> = {
  emergency: { label: 'Emergencia', className: 'bg-urgency-emergency text-white' },
  urgent: { label: 'Urgente', className: 'bg-urgency-urgent text-white' },
  less_urgent: { label: 'Pouco Urgente', className: 'bg-urgency-less-urgent text-white' },
  non_urgent: { label: 'Nao Urgente', className: 'bg-urgency-non-urgent text-white' },
}

export function UrgencyBadge({ urgency }: { urgency: string | null }) {
  if (!urgency || !URGENCY_CONFIG[urgency]) return null

  const { label, className } = URGENCY_CONFIG[urgency]

  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${className}`}>
      {label}
    </span>
  )
}
