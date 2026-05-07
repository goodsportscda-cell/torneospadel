export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
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
      inscripciones: {
        Row: {
          created_at: string
          disponibilidad_horaria: string | null
          estado: Database["public"]["Enums"]["estado_inscripcion"]
          estado_pago: Database["public"]["Enums"]["estado_pago"]
          fecha_inscripcion: string
          id: string
          jugador1_id: string
          jugador2_id: string
          monto_pagado: number | null
          notas: string | null
          observaciones: string | null
          torneo_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          disponibilidad_horaria?: string | null
          estado?: Database["public"]["Enums"]["estado_inscripcion"]
          estado_pago?: Database["public"]["Enums"]["estado_pago"]
          fecha_inscripcion?: string
          id?: string
          jugador1_id: string
          jugador2_id: string
          monto_pagado?: number | null
          notas?: string | null
          observaciones?: string | null
          torneo_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          disponibilidad_horaria?: string | null
          estado?: Database["public"]["Enums"]["estado_inscripcion"]
          estado_pago?: Database["public"]["Enums"]["estado_pago"]
          fecha_inscripcion?: string
          id?: string
          jugador1_id?: string
          jugador2_id?: string
          monto_pagado?: number | null
          notas?: string | null
          observaciones?: string | null
          torneo_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inscripciones_jugador1_id_fkey"
            columns: ["jugador1_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripciones_jugador2_id_fkey"
            columns: ["jugador2_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripciones_torneo_id_fkey"
            columns: ["torneo_id"]
            isOneToOne: false
            referencedRelation: "torneos"
            referencedColumns: ["id"]
          },
        ]
      }
      jugadores: {
        Row: {
          apellido: string
          categoria_id: string | null
          club: string | null
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
        Relationships: [
          {
            foreignKeyName: "jugadores_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_jugadores"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "partidos_llave_llave_id_fkey"
            columns: ["llave_id"]
            isOneToOne: false
            referencedRelation: "llaves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_llave_partido_local_origen_id_fkey"
            columns: ["partido_local_origen_id"]
            isOneToOne: false
            referencedRelation: "partidos_llave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_llave_partido_siguiente_id_fkey"
            columns: ["partido_siguiente_id"]
            isOneToOne: false
            referencedRelation: "partidos_llave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_llave_partido_visitante_origen_id_fkey"
            columns: ["partido_visitante_origen_id"]
            isOneToOne: false
            referencedRelation: "partidos_llave"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "partidos_zona_zona_id_fkey"
            columns: ["zona_id"]
            isOneToOne: false
            referencedRelation: "zonas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          jugador_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          jugador_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          jugador_id?: string | null
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
          inscripcion_id: string
          instancia: string
          jugador_id: string
          puntos: number
          torneo_id: string
        }
        Insert: {
          anio: number
          categoria_id?: string | null
          created_at?: string
          genero?: string | null
          id?: string
          inscripcion_id: string
          instancia: string
          jugador_id: string
          puntos?: number
          torneo_id: string
        }
        Update: {
          anio?: number
          categoria_id?: string | null
          created_at?: string
          genero?: string | null
          id?: string
          inscripcion_id?: string
          instancia?: string
          jugador_id?: string
          puntos?: number
          torneo_id?: string
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
        Relationships: [
          {
            foreignKeyName: "sets_partido_partido_id_fkey"
            columns: ["partido_id"]
            isOneToOne: false
            referencedRelation: "partidos_zona"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_partido_partido_llave_id_fkey"
            columns: ["partido_llave_id"]
            isOneToOne: false
            referencedRelation: "partidos_llave"
            referencedColumns: ["id"]
          },
        ]
      }
      torneos: {
        Row: {
          categoria_id: string | null
          categoria_libre: string | null
          costo_inscripcion: number | null
          created_at: string
          cupo_maximo: number | null
          estado: Database["public"]["Enums"]["estado_torneo"]
          fecha_fin: string | null
          fecha_inicio: string
          genero: Database["public"]["Enums"]["genero_categoria"] | null
          id: string
          multiplicador_puntos: number
          nombre: string
          notas: string | null
          numero_fecha: number | null
          premios: string | null
          sede: string | null
          tipo: Database["public"]["Enums"]["tipo_torneo"]
          updated_at: string
        }
        Insert: {
          categoria_id?: string | null
          categoria_libre?: string | null
          costo_inscripcion?: number | null
          created_at?: string
          cupo_maximo?: number | null
          estado?: Database["public"]["Enums"]["estado_torneo"]
          fecha_fin?: string | null
          fecha_inicio: string
          genero?: Database["public"]["Enums"]["genero_categoria"] | null
          id?: string
          multiplicador_puntos?: number
          nombre: string
          notas?: string | null
          numero_fecha?: number | null
          premios?: string | null
          sede?: string | null
          tipo?: Database["public"]["Enums"]["tipo_torneo"]
          updated_at?: string
        }
        Update: {
          categoria_id?: string | null
          categoria_libre?: string | null
          costo_inscripcion?: number | null
          created_at?: string
          cupo_maximo?: number | null
          estado?: Database["public"]["Enums"]["estado_torneo"]
          fecha_fin?: string | null
          fecha_inicio?: string
          genero?: Database["public"]["Enums"]["genero_categoria"] | null
          id?: string
          multiplicador_puntos?: number
          nombre?: string
          notas?: string | null
          numero_fecha?: number | null
          premios?: string | null
          sede?: string | null
          tipo?: Database["public"]["Enums"]["tipo_torneo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "torneos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "zonas_parejas_zona_id_fkey"
            columns: ["zona_id"]
            isOneToOne: false
            referencedRelation: "zonas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      estado_inscripcion:
        | "pendiente_confirmacion"
        | "confirmada"
        | "lista_espera"
        | "cancelada"
      estado_pago: "pendiente" | "parcial" | "pagado"
      estado_partido:
        | "pendiente"
        | "en_juego"
        | "finalizado"
        | "programado"
        | "suspendido"
      estado_torneo:
        | "proximamente"
        | "inscripciones_abiertas"
        | "inscripciones_cerradas"
        | "en_curso"
        | "finalizado"
        | "cancelado"
      genero_categoria: "caballeros" | "damas" | "mixto"
      ronda_llave:
        | "previa"
        | "dieciseisavos"
        | "octavos"
        | "cuartos"
        | "semifinal"
        | "final"
      tipo_partido_zona: "directo" | "ganadores" | "perdedores"
      tipo_torneo: "oficial" | "americano"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      estado_inscripcion: [
        "pendiente_confirmacion",
        "confirmada",
        "lista_espera",
        "cancelada",
      ],
      estado_pago: ["pendiente", "parcial", "pagado"],
      estado_partido: [
        "pendiente",
        "en_juego",
        "finalizado",
        "programado",
        "suspendido",
      ],
      estado_torneo: [
        "proximamente",
        "inscripciones_abiertas",
        "inscripciones_cerradas",
        "en_curso",
        "finalizado",
        "cancelado",
      ],
      genero_categoria: ["caballeros", "damas", "mixto"],
      ronda_llave: [
        "previa",
        "dieciseisavos",
        "octavos",
        "cuartos",
        "semifinal",
        "final",
      ],
      tipo_partido_zona: ["directo", "ganadores", "perdedores"],
      tipo_torneo: ["oficial", "americano"],
    },
  },
} as const
