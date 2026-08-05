export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

export interface Database {
  public: {
    Tables: {
      clubes: {
        Row: {
          id: string
          nombre: string
          slug: string
          logo_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          slug: string
          logo_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          slug?: string
          logo_url?: string | null
          created_at?: string
        }
      }
      perfiles: {
        Row: {
          id: string
          rol: "super_admin" | "club_admin" | "jugador"
          club_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          rol: "super_admin" | "club_admin" | "jugador"
          club_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          rol?: "super_admin" | "club_admin" | "jugador"
          club_id?: string | null
          created_at?: string
        }
      }
      torneos: {
        Row: {
          id: string
          nombre: string
          tipo: "oficial" | "americano" | "americano_individual"
          categoria_id: string | null
          categoria_libre: string | null
          genero: "caballeros" | "damas" | "mixto" | null
          fecha_inicio: string
          fecha_fin: string | null
          sede: string | null
          costo_inscripcion: number | null
          premios: string | null
          estado: "proximamente" | "inscripciones_abiertas" | "inscripciones_cerradas" | "en_curso" | "finalizado" | "cancelado"
          notas: string | null
          numero_fecha: number | null
          multiplicador_puntos: number | null
          cupo_maximo: number | null
          canchas_count: number | null
          costo_fecha_jugador: number | null
          costo_fecha_cancha: number | null
          porcentaje_premios: number | null
          modalidad: string | null
          desafio_semanas: number | null
          ingresos_sponsors: number | null
          gastos_trofeos: number | null
          gastos_regalos: number | null
          datos_bancarios: string | null
          canchas_disponibles: number | null
          club_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          tipo?: "oficial" | "americano" | "americano_individual"
          categoria_id?: string | null
          categoria_libre?: string | null
          genero?: "caballeros" | "damas" | "mixto" | null
          fecha_inicio: string
          fecha_fin?: string | null
          sede?: string | null
          costo_inscripcion?: number | null
          premios?: string | null
          estado?: "proximamente" | "inscripciones_abiertas" | "inscripciones_cerradas" | "en_curso" | "finalizado" | "cancelado"
          notas?: string | null
          numero_fecha?: number | null
          multiplicador_puntos?: number | null
          cupo_maximo?: number | null
          canchas_count?: number | null
          costo_fecha_jugador?: number | null
          costo_fecha_cancha?: number | null
          porcentaje_premios?: number | null
          modalidad?: string | null
          desafio_semanas?: number | null
          ingresos_sponsors?: number | null
          gastos_trofeos?: number | null
          gastos_regalos?: number | null
          datos_bancarios?: string | null
          canchas_disponibles?: number | null
          club_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          tipo?: "oficial" | "americano" | "americano_individual"
          categoria_id?: string | null
          categoria_libre?: string | null
          genero?: "caballeros" | "damas" | "mixto" | null
          fecha_inicio?: string
          fecha_fin?: string | null
          sede?: string | null
          costo_inscripcion?: number | null
          premios?: string | null
          estado?: "proximamente" | "inscripciones_abiertas" | "inscripciones_cerradas" | "en_curso" | "finalizado" | "cancelado"
          notas?: string | null
          numero_fecha?: number | null
          multiplicador_puntos?: number | null
          cupo_maximo?: number | null
          canchas_count?: number | null
          costo_fecha_jugador?: number | null
          costo_fecha_cancha?: number | null
          porcentaje_premios?: number | null
          modalidad?: string | null
          desafio_semanas?: number | null
          ingresos_sponsors?: number | null
          gastos_trofeos?: number | null
          gastos_regalos?: number | null
          datos_bancarios?: string | null
          canchas_disponibles?: number | null
          club_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      jugadores: {
        Row: {
          id: string
          dni: string | null
          nombre: string
          apellido: string
          telefono: string | null
          email: string | null
          club: string | null
          categoria_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dni?: string | null
          nombre: string
          apellido: string
          telefono?: string | null
          email?: string | null
          club?: string | null
          categoria_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          dni?: string | null
          nombre?: string
          apellido?: string
          telefono?: string | null
          email?: string | null
          club?: string | null
          categoria_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      categorias: {
        Row: {
          id: string
          nombre: string
          genero: "caballeros" | "damas" | "mixto"
          orden: number
          activa: boolean
          club_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          genero: "caballeros" | "damas" | "mixto"
          orden?: number
          activa?: boolean
          club_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          genero?: "caballeros" | "damas" | "mixto"
          orden?: number
          activa?: boolean
          club_id?: string | null
          created_at?: string
        }
      }
      inscripciones: {
        Row: {
          id: string
          torneo_id: string
          jugador1_id: string
          jugador2_id: string
          estado_pago: "pendiente" | "parcial" | "pagado"
          monto_pagado: number
          fecha_inscripcion: string
          notas: string | null
          disponibilidad_horaria: string | null
          estado: "pendiente_confirmacion" | "confirmada" | "lista_espera" | "cancelada"
          comprobante_url: string | null
          pago_j1_estado: string | null
          pago_j1_metodo: string | null
          pago_j1_comprobante: string | null
          pago_j2_estado: string | null
          pago_j2_metodo: string | null
          pago_j2_comprobante: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          torneo_id: string
          jugador1_id: string
          jugador2_id: string
          estado_pago?: "pendiente" | "parcial" | "pagado"
          monto_pagado?: number
          fecha_inscripcion?: string
          notas?: string | null
          disponibilidad_horaria?: string | null
          estado?: "pendiente_confirmacion" | "confirmada" | "lista_espera" | "cancelada"
          comprobante_url?: string | null
          pago_j1_estado?: string | null
          pago_j1_metodo?: string | null
          pago_j1_comprobante?: string | null
          pago_j2_estado?: string | null
          pago_j2_metodo?: string | null
          pago_j2_comprobante?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          torneo_id?: string
          jugador1_id?: string
          jugador2_id?: string
          estado_pago?: "pendiente" | "parcial" | "pagado"
          monto_pagado?: number
          fecha_inscripcion?: string
          notas?: string | null
          disponibilidad_horaria?: string | null
          estado?: "pendiente_confirmacion" | "confirmada" | "lista_espera" | "cancelada"
          comprobante_url?: string | null
          pago_j1_estado?: string | null
          pago_j1_metodo?: string | null
          pago_j1_comprobante?: string | null
          pago_j2_estado?: string | null
          pago_j2_metodo?: string | null
          pago_j2_comprobante?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      torneo_franjas_horarias: {
        Row: {
          id: string
          torneo_id: string
          dia_nombre: string
          hora_inicio: string
          hora_fin: string
          label_franja: string
          created_at: string
        }
        Insert: {
          id?: string
          torneo_id: string
          dia_nombre: string
          hora_inicio: string
          hora_fin: string
          label_franja: string
          created_at?: string
        }
        Update: {
          id?: string
          torneo_id?: string
          dia_nombre?: string
          hora_inicio?: string
          hora_fin?: string
          label_franja?: string
          created_at?: string
        }
      }
      inscripcion_disponibilidades: {
        Row: {
          id: string
          inscripcion_id: string
          franja_id: string
          created_at: string
        }
        Insert: {
          id?: string
          inscripcion_id: string
          franja_id: string
          created_at?: string
        }
        Update: {
          id?: string
          inscripcion_id?: string
          franja_id?: string
          created_at?: string
        }
      }
      torneo_individual_jugadores: {
        Row: {
          id: string
          torneo_id: string
          jugador_id: string
          estado: string
          created_at: string
        }
        Insert: {
          id?: string
          torneo_id: string
          jugador_id: string
          estado?: string
          created_at?: string
        }
        Update: {
          id?: string
          torneo_id?: string
          jugador_id?: string
          estado?: string
          created_at?: string
        }
      }
      torneo_individual_parejas: {
        Row: {
          id: string
          torneo_id: string
          jugador1_id: string
          jugador2_id: string
          created_at: string
        }
        Insert: {
          id?: string
          torneo_id: string
          jugador1_id: string
          jugador2_id: string
          created_at?: string
        }
        Update: {
          id?: string
          torneo_id?: string
          jugador1_id?: string
          jugador2_id?: string
          created_at?: string
        }
      }
      torneo_individual_fechas: {
        Row: {
          id: string
          torneo_id: string
          fecha: number
          costo_canchas: number
          estado: string
          created_at: string
        }
        Insert: {
          id?: string
          torneo_id: string
          fecha: number
          costo_canchas?: number
          estado?: string
          created_at?: string
        }
        Update: {
          id?: string
          torneo_id?: string
          fecha?: number
          costo_canchas?: number
          estado?: string
          created_at?: string
        }
      }
      torneo_individual_pagos: {
        Row: {
          id: string
          torneo_id: string
          fecha: number
          jugador_id: string
          monto_pagado: number
          estado_pago: "pendiente" | "parcial" | "pagado"
          created_at: string
        }
        Insert: {
          id?: string
          torneo_id: string
          fecha: number
          jugador_id: string
          monto_pagado?: number
          estado_pago?: "pendiente" | "parcial" | "pagado"
          created_at?: string
        }
        Update: {
          id?: string
          torneo_id?: string
          fecha?: number
          jugador_id?: string
          monto_pagado?: number
          estado_pago?: "pendiente" | "parcial" | "pagado"
          created_at?: string
        }
      }
      partidos_individuales: {
        Row: {
          id: string
          torneo_id: string
          fecha: number
          cancha: string
          jugador1_id: string
          jugador2_id: string
          jugador3_id: string
          jugador4_id: string
          suplente1_nombre: string | null
          suplente2_nombre: string | null
          suplente3_nombre: string | null
          suplente4_nombre: string | null
          sets_pareja1: number
          sets_pareja2: number
          estado: "pendiente" | "en_juego" | "finalizado"
          fecha_programada: string | null
          hora_programada: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          torneo_id: string
          fecha: number
          cancha: string
          jugador1_id: string
          jugador2_id: string
          jugador3_id: string
          jugador4_id: string
          suplente1_nombre?: string | null
          suplente2_nombre?: string | null
          suplente3_nombre?: string | null
          suplente4_nombre?: string | null
          sets_pareja1?: number
          sets_pareja2?: number
          estado?: "pendiente" | "en_juego" | "finalizado"
          fecha_programada?: string | null
          hora_programada?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          torneo_id?: string
          fecha?: number
          cancha?: string
          jugador1_id?: string
          jugador2_id?: string
          jugador3_id?: string
          jugador4_id?: string
          suplente1_nombre?: string | null
          suplente2_nombre?: string | null
          suplente3_nombre?: string | null
          suplente4_nombre?: string | null
          sets_pareja1?: number
          sets_pareja2?: number
          estado?: "pendiente" | "en_juego" | "finalizado"
          fecha_programada?: string | null
          hora_programada?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sets_partido_individual: {
        Row: {
          id: string
          partido_individual_id: string
          numero_set: number
          games_pareja1: number
          games_pareja2: number
          created_at: string
        }
        Insert: {
          id?: string
          partido_individual_id: string
          numero_set: number
          games_pareja1?: number
          games_pareja2?: number
          created_at?: string
        }
        Update: {
          id?: string
          partido_individual_id?: string
          numero_set?: number
          games_pareja1?: number
          games_pareja2?: number
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      tipo_torneo: "oficial" | "americano" | "americano_individual"
      genero_categoria: "caballeros" | "damas" | "mixto"
      estado_torneo: "proximamente" | "inscripciones_abiertas" | "inscripciones_cerradas" | "en_curso" | "finalizado" | "cancelado"
      estado_pago: "pendiente" | "parcial" | "pagado"
      estado_inscripcion: "pendiente_confirmacion" | "confirmada" | "lista_espera" | "cancelada"
      estado_partido: "pendiente" | "en_juego" | "finalizado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
