export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ascensos: {
        Row: {
          anio: number
          categoria_destino_id: string
          categoria_origen_id: string
          created_at: string
          fecha: string
          id: string
          jugador_id: string
          notas: string | null
          puntos_origen: number
          puntos_transferidos: number
        }
        Insert: {
          anio: number
          categoria_destino_id: string
          categoria_origen_id: string
          created_at?: string
          fecha?: string
          id?: string
          jugador_id: string
          notas?: string | null
          puntos_origen?: number
          puntos_transferidos?: number
        }
        Update: {
          anio?: number
          categoria_destino_id?: string
          categoria_origen_id?: string
          created_at?: string
          fecha?: string
          id?: string
          jugador_id?: string
          notas?: string | null
          puntos_origen?: number
          puntos_transferidos?: number
        }
        Relationships: []
      }
      categorias: {
        Row: {
          activa: boolean
          club_id: string | null
          created_at: string
          genero: Database["public"]["Enums"]["genero_categoria"]
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activa?: boolean
          club_id?: string | null
          created_at?: string
          genero: Database["public"]["Enums"]["genero_categoria"]
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          activa?: boolean
          club_id?: string | null
          created_at?: string
          genero?: Database["public"]["Enums"]["genero_categoria"]
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      categorias_jugadores: {
        Row: {
          activa: boolean
          created_at: string
          genero: Database["public"]["Enums"]["genero_categoria"]
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activa?: boolean
          created_at?: string
          genero: Database["public"]["Enums"]["genero_categoria"]
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          activa?: boolean
          created_at?: string
          genero?: Database["public"]["Enums"]["genero_categoria"]
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      clubes: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          nombre: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          nombre: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          nombre?: string
          slug?: string
        }
        Relationships: []
      }
      cupos_master: {
        Row: {
          categoria_id: string
          created_at: string
          cupos: number
          id: string
          updated_at: string
        }
        Insert: {
          categoria_id: string
          created_at?: string
          cupos?: number
          id?: string
          updated_at?: string
        }
        Update: {
          categoria_id?: string
          created_at?: string
          cupos?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      inscripcion_disponibilidades: {
        Row: {
          created_at: string
          franja_id: string
          id: string
          inscripcion_id: string
        }
        Insert: {
          created_at?: string
          franja_id: string
          id?: string
          inscripcion_id: string
        }
        Update: {
          created_at?: string
          franja_id?: string
          id?: string
          inscripcion_id?: string
        }
        Relationships: []
      }
      inscripciones: {
        Row: {
          created_at: string
          estado: Database["public"]["Enums"]["estado_inscripcion"]
          estado_pago: Database["public"]["Enums"]["estado_pago"]
          fecha_inscripcion: string
          id: string
          jugador1_id: string
          jugador2_id: string
          monto_pagado: number | null
          notas: string | null
          torneo_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_inscripcion"]
          estado_pago?: Database["public"]["Enums"]["estado_pago"]
          fecha_inscripcion?: string
          id?: string
          jugador1_id: string
          jugador2_id: string
          monto_pagado?: number | null
          notas?: string | null
          torneo_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_inscripcion"]
          estado_pago?: Database["public"]["Enums"]["estado_pago"]
          fecha_inscripcion?: string
          id?: string
          jugador1_id?: string
          jugador2_id?: string
          monto_pagado?: number | null
          notas?: string | null
          torneo_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      jugadores: {
        Row: {
          apellido: string
          categoria_id: string | null
          club: string | null
          ciudad: string | null
          created_at: string
          dni: string | null
          email: string | null
          genero: Database["public"]["Enums"]["genero_categoria"] | null
          id: string
          nombre: string
          notas: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          apellido: string
          categoria_id?: string | null
          club?: string | null
          ciudad?: string | null
          created_at?: string
          dni?: string | null
          email?: string | null
          genero?: Database["public"]["Enums"]["genero_categoria"] | null
          id?: string
          nombre: string
          notas?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          apellido?: string
          categoria_id?: string | null
          club?: string | null
          ciudad?: string | null
          created_at?: string
          dni?: string | null
          email?: string | null
          genero?: Database["public"]["Enums"]["genero_categoria"] | null
          id?: string
          nombre?: string
          notas?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      llaves: {
        Row: {
          cantidad_parejas: number
          created_at: string
          id: string
          tamanio_cuadro: number
          torneo_id: string
          updated_at: string
        }
        Insert: {
          cantidad_parejas: number
          created_at?: string
          id?: string
          tamanio_cuadro: number
          torneo_id: string
          updated_at?: string
        }
        Update: {
          cantidad_parejas?: number
          created_at?: string
          id?: string
          tamanio_cuadro?: number
          torneo_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      partidos_individuales: {
        Row: {
          cancha: string
          created_at: string
          fecha: number
          fecha_hora: string | null
          id: string
          jugador1_id: string | null
          jugador2_id: string | null
          jugador3_id: string | null
          jugador4_id: string | null
          sets_pareja1: number | null
          sets_pareja2: number | null
          estado: Database["public"]["Enums"]["estado_partido"]
          suplente1_nombre: string | null
          suplente2_nombre: string | null
          suplente3_nombre: string | null
          suplente4_nombre: string | null
          torneo_id: string
          updated_at: string
        }
        Insert: {
          cancha: string
          created_at?: string
          fecha: number
          fecha_hora?: string | null
          id?: string
          jugador1_id?: string | null
          jugador2_id?: string | null
          jugador3_id?: string | null
          jugador4_id?: string | null
          sets_pareja1?: number | null
          sets_pareja2?: number | null
          estado?: Database["public"]["Enums"]["estado_partido"]
          suplente1_nombre?: string | null
          suplente2_nombre?: string | null
          suplente3_nombre?: string | null
          suplente4_nombre?: string | null
          torneo_id: string
          updated_at?: string
        }
        Update: {
          cancha?: string
          created_at?: string
          fecha?: number
          fecha_hora?: string | null
          id?: string
          jugador1_id?: string | null
          jugador2_id?: string | null
          jugador3_id?: string | null
          jugador4_id?: string | null
          sets_pareja1?: number | null
          sets_pareja2?: number | null
          estado?: Database["public"]["Enums"]["estado_partido"]
          suplente1_nombre?: string | null
          suplente2_nombre?: string | null
          suplente3_nombre?: string | null
          suplente4_nombre?: string | null
          torneo_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      partidos_llave: {
        Row: {
          cancha: string | null
          created_at: string
          estado: Database["public"]["Enums"]["estado_partido"]
          fecha_hora: string | null
          ganador_id: string | null
          id: string
          llave_id: string
          numero: number
          pareja_local_id: string | null
          pareja_visitante_id: string | null
          partido_local_origen_id: string | null
          partido_siguiente_id: string | null
          partido_visitante_origen_id: string | null
          posicion_siguiente: string | null
          ref_local: string | null
          ref_visitante: string | null
          ronda: Database["public"]["Enums"]["ronda_llave"]
          updated_at: string
        }
        Insert: {
          cancha?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_partido"]
          fecha_hora?: string | null
          ganador_id?: string | null
          id?: string
          llave_id: string
          numero: number
          pareja_local_id?: string | null
          pareja_visitante_id?: string | null
          partido_local_origen_id?: string | null
          partido_siguiente_id?: string | null
          partido_visitante_origen_id?: string | null
          posicion_siguiente?: string | null
          ref_local?: string | null
          ref_visitante?: string | null
          ronda: Database["public"]["Enums"]["ronda_llave"]
          updated_at?: string
        }
        Update: {
          cancha?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_partido"]
          fecha_hora?: string | null
          ganador_id?: string | null
          id?: string
          llave_id?: string
          numero?: number
          pareja_local_id?: string | null
          pareja_visitante_id?: string | null
          partido_local_origen_id?: string | null
          partido_siguiente_id?: string | null
          partido_visitante_origen_id?: string | null
          posicion_siguiente?: string | null
          ref_local?: string | null
          ref_visitante?: string | null
          ronda?: Database["public"]["Enums"]["ronda_llave"]
          updated_at?: string
        }
        Relationships: []
      }
      partidos_zona: {
        Row: {
          cancha: string | null
          created_at: string
          estado: Database["public"]["Enums"]["estado_partido"]
          fecha_hora: string | null
          ganador_id: string | null
          id: string
          orden: number
          pareja_local_id: string | null
          pareja_visitante_id: string | null
          posicion_local: number | null
          posicion_visitante: number | null
          tipo: Database["public"]["Enums"]["tipo_partido_zona"]
          updated_at: string
          zona_id: string
        }
        Insert: {
          cancha?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_partido"]
          fecha_hora?: string | null
          ganador_id?: string | null
          id?: string
          orden: number
          pareja_local_id?: string | null
          pareja_visitante_id?: string | null
          posicion_local?: number | null
          posicion_visitante?: number | null
          tipo?: Database["public"]["Enums"]["tipo_partido_zona"]
          updated_at?: string
          zona_id: string
        }
        Update: {
          cancha?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_partido"]
          fecha_hora?: string | null
          ganador_id?: string | null
          id?: string
          orden?: number
          pareja_local_id?: string | null
          pareja_visitante_id?: string | null
          posicion_local?: number | null
          posicion_visitante?: number | null
          tipo?: Database["public"]["Enums"]["tipo_partido_zona"]
          updated_at?: string
          zona_id?: string
        }
        Relationships: []
      }
      perfiles: {
        Row: {
          club_id: string | null
          created_at: string
          id: string
          rol: string
        }
        Insert: {
          club_id?: string | null
          created_at?: string
          id: string
          rol: string
        }
        Update: {
          club_id?: string | null
          created_at?: string
          id?: string
          rol?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      puntos_ranking: {
        Row: {
          created_at: string
          id: string
          instancia: string
          orden: number
          puntos: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instancia: string
          orden?: number
          puntos?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instancia?: string
          orden?: number
          puntos?: number
          updated_at?: string
        }
        Relationships: []
      }
      ranking_jugadores: {
        Row: {
          anio: number
          categoria_id: string | null
          created_at: string
          genero: string | null
          id: string
          inscripcion_id: string | null
          instancia: string
          jugador_id: string
          puntos: number
          torneo_id: string | null
        }
        Insert: {
          anio: number
          categoria_id?: string | null
          created_at?: string
          genero?: string | null
          id?: string
          inscripcion_id?: string | null
          instancia: string
          jugador_id: string
          puntos?: number
          torneo_id?: string | null
        }
        Update: {
          anio?: number
          categoria_id?: string | null
          created_at?: string
          genero?: string | null
          id?: string
          inscripcion_id?: string | null
          instancia?: string
          jugador_id?: string
          puntos?: number
          torneo_id?: string | null
        }
        Relationships: []
      }
      sets_partido: {
        Row: {
          created_at: string
          games_local: number
          games_visitante: number
          id: string
          numero_set: number
          partido_id: string | null
          partido_llave_id: string | null
        }
        Insert: {
          created_at?: string
          games_local?: number
          games_visitante?: number
          id?: string
          numero_set: number
          partido_id?: string | null
          partido_llave_id?: string | null
        }
        Update: {
          created_at?: string
          games_local?: number
          games_visitante?: number
          id?: string
          numero_set?: number
          partido_id?: string | null
          partido_llave_id?: string | null
        }
        Relationships: []
      }
      sets_partido_individual: {
        Row: {
          created_at: string
          games_pareja1: number
          games_pareja2: number
          id: string
          numero_set: number
          partido_individual_id: string
        }
        Insert: {
          created_at?: string
          games_pareja1?: number
          games_pareja2?: number
          id?: string
          numero_set: number
          partido_individual_id: string
        }
        Update: {
          created_at?: string
          games_pareja1?: number
          games_pareja2?: number
          id?: string
          numero_set?: number
          partido_individual_id?: string
        }
        Relationships: []
      }
      torneo_franjas_horarias: {
        Row: {
          created_at: string
          dia_nombre: string
          hora_fin: string
          hora_inicio: string
          id: string
          label_franja: string
          torneo_id: string
        }
        Insert: {
          created_at?: string
          dia_nombre: string
          hora_fin: string
          hora_inicio: string
          id?: string
          label_franja: string
          torneo_id: string
        }
        Update: {
          created_at?: string
          dia_nombre?: string
          hora_fin?: string
          hora_inicio?: string
          id?: string
          label_franja?: string
          torneo_id?: string
        }
        Relationships: []
      }
      torneo_individual_fechas: {
        Row: {
          costo_canchas: number
          created_at: string
          estado: string
          fecha: number
          id: string
          leyenda: string | null
          publicado: boolean | null
          torneo_id: string
        }
        Insert: {
          costo_canchas?: number
          created_at?: string
          estado?: string
          fecha: number
          id?: string
          leyenda?: string | null
          publicado?: boolean | null
          torneo_id: string
        }
        Update: {
          costo_canchas?: number
          created_at?: string
          estado?: string
          fecha?: number
          id?: string
          leyenda?: string | null
          publicado?: boolean | null
          torneo_id?: string
        }
        Relationships: []
      }
      torneo_individual_jugadores: {
        Row: {
          created_at: string
          estado: string
          id: string
          jugador_id: string
          torneo_id: string
        }
        Insert: {
          created_at?: string
          estado?: string
          id?: string
          jugador_id: string
          torneo_id: string
        }
        Update: {
          created_at?: string
          estado?: string
          id?: string
          jugador_id?: string
          torneo_id?: string
        }
        Relationships: []
      }
      torneo_individual_pagos: {
        Row: {
          created_at: string
          estado_pago: Database["public"]["Enums"]["estado_pago"]
          fecha: number
          id: string
          jugador_id: string
          monto_pagado: number
          torneo_id: string
        }
        Insert: {
          created_at?: string
          estado_pago?: Database["public"]["Enums"]["estado_pago"]
          fecha: number
          id?: string
          jugador_id: string
          monto_pagado?: number
          torneo_id: string
        }
        Update: {
          created_at?: string
          estado_pago?: Database["public"]["Enums"]["estado_pago"]
          fecha?: number
          id?: string
          jugador_id?: string
          monto_pagado?: number
          torneo_id?: string
        }
        Relationships: []
      }
      torneo_individual_parejas: {
        Row: {
          created_at: string
          id: string
          jugador1_id: string
          jugador2_id: string
          torneo_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          jugador1_id: string
          jugador2_id: string
          torneo_id: string
        }
        Update: {
          created_at?: string
          id?: string
          jugador1_id?: string
          jugador2_id?: string
          torneo_id?: string
        }
        Relationships: []
      }
      torneos: {
        Row: {
          canchas_count: number | null
          canchas_disponibles: number | null
          categoria_id: string | null
          categoria_libre: string | null
          club_id: string | null
          costo_fecha_cancha: number | null
          costo_fecha_jugador: number | null
          costo_inscripcion: number | null
          created_at: string
          cupo_maximo: number | null
          datos_bancarios: string | null
          desafio_semanas: number | null
          estado: Database["public"]["Enums"]["estado_torneo"]
          fecha_fin: string | null
          fecha_inicio: string
          gastos_regalos: number | null
          gastos_trofeos: number | null
          genero: Database["public"]["Enums"]["genero_categoria"] | null
          id: string
          ingresos_sponsors: number | null
          modalidad: string | null
          multiplicador_puntos: number
          nombre: string
          notas: string | null
          numero_fecha: number | null
          porcentaje_premios: number | null
          premios: string | null
          ranking_publicado: boolean | null
          sede: string | null
          slug: string | null
          subtitulo_fase: string | null
          tipo: Database["public"]["Enums"]["tipo_torneo"]
          updated_at: string
        }
        Insert: {
          canchas_count?: number | null
          canchas_disponibles?: number | null
          categoria_id?: string | null
          categoria_libre?: string | null
          club_id?: string | null
          costo_fecha_cancha?: number | null
          costo_fecha_jugador?: number | null
          costo_inscripcion?: number | null
          created_at?: string
          cupo_maximo?: number | null
          datos_bancarios?: string | null
          desafio_semanas?: number | null
          estado?: Database["public"]["Enums"]["estado_torneo"]
          fecha_fin?: string | null
          fecha_inicio: string
          gastos_regalos?: number | null
          gastos_trofeos?: number | null
          genero?: Database["public"]["Enums"]["genero_categoria"] | null
          id?: string
          ingresos_sponsors?: number | null
          modalidad?: string | null
          multiplicador_puntos?: number
          nombre: string
          notas?: string | null
          numero_fecha?: number | null
          porcentaje_premios?: number | null
          premios?: string | null
          ranking_publicado?: boolean | null
          sede?: string | null
          slug?: string | null
          subtitulo_fase?: string | null
          tipo?: Database["public"]["Enums"]["tipo_torneo"]
          updated_at?: string
        }
        Update: {
          canchas_count?: number | null
          canchas_disponibles?: number | null
          categoria_id?: string | null
          categoria_libre?: string | null
          club_id?: string | null
          costo_fecha_cancha?: number | null
          costo_fecha_jugador?: number | null
          costo_inscripcion?: number | null
          created_at?: string
          cupo_maximo?: number | null
          datos_bancarios?: string | null
          desafio_semanas?: number | null
          estado?: Database["public"]["Enums"]["estado_torneo"]
          fecha_fin?: string | null
          fecha_inicio?: string
          gastos_regalos?: number | null
          gastos_trofeos?: number | null
          genero?: Database["public"]["Enums"]["genero_categoria"] | null
          id?: string
          ingresos_sponsors?: number | null
          modalidad?: string | null
          multiplicador_puntos?: number
          nombre?: string
          notas?: string | null
          numero_fecha?: number | null
          porcentaje_premios?: number | null
          premios?: string | null
          ranking_publicado?: boolean | null
          sede?: string | null
          slug?: string | null
          subtitulo_fase?: string | null
          tipo?: Database["public"]["Enums"]["tipo_torneo"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      zonas: {
        Row: {
          created_at: string
          id: string
          nombre: string
          orden: number
          tamanio: number
          torneo_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          orden?: number
          tamanio: number
          torneo_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
          tamanio?: number
          torneo_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      zonas_parejas: {
        Row: {
          created_at: string
          id: string
          inscripcion_id: string
          posicion_siembra: number
          zona_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inscripcion_id: string
          posicion_siembra: number
          zona_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inscripcion_id?: string
          posicion_siembra?: number
          zona_id?: string
        }
        Relationships: []
      }
    } & {
      [key: string]: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
        Relationships: any[]
      }
    }
    Views: {
      [key: string]: {
        Row: Record<string, unknown>
        Relationships: any[]
      }
    }
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>
        Returns: unknown
      }
    }
    Enums: {
      app_role: "admin" | "user" | "operador"
      estado_inscripcion: "pendiente_confirmacion" | "confirmada" | "lista_espera" | "cancelada"
      estado_pago: "pendiente" | "parcial" | "pagado"
      estado_partido: "pendiente" | "en_juego" | "finalizado" | "programado" | "suspendido"
      estado_torneo: "proximamente" | "inscripciones_abiertas" | "inscripciones_cerradas" | "en_curso" | "finalizado" | "cancelado"
      genero_categoria: "caballeros" | "damas" | "mixto"
      ronda_llave: "previa" | "dieciseisavos" | "octavos" | "cuartos" | "semifinal" | "final"
      tipo_partido_zona: "directo" | "ganadores" | "perdedores"
      tipo_torneo: "oficial" | "americano" | "americano_individual"
    }
    CompositeTypes: {
      [key: string]: unknown
    }
  }
}
