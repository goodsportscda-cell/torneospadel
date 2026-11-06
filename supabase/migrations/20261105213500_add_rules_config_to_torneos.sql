-- Migración segura: Motor de Reglas Modular (rules_config JSONB) para Ligas y Desafíos Semanales
-- No afecta torneos oficiales de fin de semana ni resultados ya cargados.

ALTER TABLE public.torneos
ADD COLUMN IF NOT EXISTS rules_config JSONB DEFAULT '{
  "formato_competicion": "convencional",
  "puntos_victoria_2_0": 3,
  "puntos_victoria_2_1": 2,
  "puntos_derrota_1_2": 1,
  "puntos_derrota_0_2": 0,
  "puntos_wo_perdedor": 0,
  "wo_score_simbolico": "6-0, 6-0",
  "criterios_desempate": [
    "puntos",
    "enfrentamiento_directo",
    "diferencia_sets",
    "diferencia_games",
    "sorteo"
  ],
  "puntos_por_cancha": {
    "1": { "victoria": 4, "derrota": 1 },
    "2": { "victoria": 3, "derrota": 1 },
    "3": { "victoria": 2, "derrota": 1 },
    "4": { "victoria": 2, "derrota": 1 },
    "5": { "victoria": 2, "derrota": 1 },
    "6": { "victoria": 2, "derrota": 1 }
  }
}'::jsonb;

COMMENT ON COLUMN public.torneos.rules_config IS 'Configuración modular del motor de reglas (formato_competicion, puntos por resultado, W.O., puntos_por_cancha en formato escalera_semanal y criterios_desempate).';

