export type AppRole = 'patient' | 'doctor' | 'admin'

export interface Patient {
  id: string
  user_id: string
  full_name: string
  cpf: string
  birth_date: string | null
  phone: string | null
  created_at: string
}

export interface Doctor {
  id: string
  user_id: string
  full_name: string
  crm: string
  specialty: string | null
  created_at: string
}

export interface SOAPNote {
  subjetivo: string
  objetivo: string
  avaliacao: string
  plano: string
}

export interface DiagnosticHypothesis {
  hypothesis: string
  probability: 'alta' | 'media' | 'baixa'
  justification: string
}

export interface ConsultationSummary {
  soap: SOAPNote
  queixa_principal: string
  resumo_geral: string
}

export interface Consultation {
  id: string
  patient_id: string
  doctor_id: string | null
  status: 'waiting' | 'in_review' | 'contacted' | 'completed'
  transcript: string | null
  summary: ConsultationSummary | null
  urgency: 'emergency' | 'urgent' | 'less_urgent' | 'non_urgent' | null
  hypotheses: DiagnosticHypothesis[] | null
  created_at: string
  updated_at: string
}

export interface ConsultationWithPatient extends Consultation {
  patients: Pick<Patient, 'full_name' | 'birth_date' | 'phone'>
}

export interface UserRole {
  id: number
  user_id: string
  role: AppRole
}

export interface Database {
  public: {
    Tables: {
      patients: {
        Row: Patient
      }
      doctors: {
        Row: Doctor
      }
      consultations: {
        Row: Consultation
      }
      user_roles: {
        Row: UserRole
      }
    }
  }
}
