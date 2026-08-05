import { Edge, Node } from "reactflow";
import { PartidoLlavePlantilla, parseRef } from "./llaves";
import { Database } from "../types/supabase";

type PartidoLlave = Database["public"]["Tables"]["partidos_llave"]["Row"];

export function generarNodosYAristas(
  plantilla: { cantidad: number; partidos: PartidoLlavePlantilla[] },
  numRondas: number,
  partidosLlave: PartidoLlave[]
): { nodes: Node[]; edges: Edge[] } {
  const newNodes: Node[] = [];
  const newEdges: Edge[] = [];

  const HORIZONTAL_SPACING = 300;
  const VERTICAL_SPACING = 100;

  // Usa partidosLlave si existe, sino usa plantilla
  const getRefLocal = (numero: number) => {
    const pReal = partidosLlave.find(p => p.numero === numero);
    if (pReal && pReal.ref_local) return pReal.ref_local;
    return plantilla.partidos.find(p => p.numero === numero)?.ref_local || "";
  }
  const getRefVisi = (numero: number) => {
    const pReal = partidosLlave.find(p => p.numero === numero);
    if (pReal && pReal.ref_visitante) return pReal.ref_visitante;
    return plantilla.partidos.find(p => p.numero === numero)?.ref_visitante || "";
  }

  // Identificar el nivel de cada partido (ronda)
  // Final = 0, Semis = 1, Cuartos = 2, etc.
  // ... rest of the layout logic. 
  // Wait, I can just modify Llaves.tsx directly instead of writing a new function here!
}
