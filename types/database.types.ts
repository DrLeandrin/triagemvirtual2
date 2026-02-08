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

export interface Consultation {
  id: string
  patient_id: string
  doctor_id: string | null
  status: 'waiting' | 'in_review' | 'contacted' | 'completed'
  transcript: string | null
  summary: string | null
  urgency: 'emergency' | 'urgent' | 'less_urgent' | 'non_urgent' | null
  created_at: string
  updated_at: string
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
