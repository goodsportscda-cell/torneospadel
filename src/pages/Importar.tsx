import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Torneo = Database["public"]["Tables"]["torneos"]["Row"];

// ── Normalización de cabeceras ──────────────────────────────────────────
const norm = (s: string) =>
  s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Cada entrada: lista de keywords que TODAS deben aparecer en la cabecera
const COLUMN_MATCHERS = {
  nombre1: [["apellido", "nombre", "1"], ["jugador", "1", "nombre"]],
  dni1: [["dni", "1"], ["dni", "jugador", "1"]],
  whatsapp1: [["whatsapp", "1"], ["telefono", "1"], ["celular", "1"]],
  ciudad1: [["ciudad", "1"], ["club", "1"], ["localidad", "1"]],
  nombre2: [["apellido", "nombre", "2"], ["jugador", "2", "nombre"]],
  dni2: [["dni", "2"], ["dni", "jugador", "2"]],
  whatsapp2: [["whatsapp", "2"], ["telefono", "2"], ["celular", "2"]],
  ciudad2: [["ciudad", "2"], ["club", "2"], ["localidad", "2"]],
  disponibilidad: [["disponibilidad"], ["horario"]],
  observaciones: [["observacion"], ["nota"]],
} as const;

type ColumnKey = keyof typeof COLUMN_MATCHERS;

const matchHeader = (header: string, key: ColumnKey): boolean => {
  const n = " " + norm(header) + " ";
  return COLUMN_MATCHERS[key].some((kws) =>
    kws.every((kw) => n.includes(" " + kw + " ") || n.includes(kw))
  );
};

const findColumnIndex = (headers: string[], key: ColumnKey): number =>
  headers.findIndex((h) => matchHeader(h, key));

// ── Parseo de "Apellido y Nombre" ───────────────────────────────────────
const parseApellidoNombre = (raw: string): { apellido: string; nombre: string } => {
  const clean = raw.trim().replace(/\s+/g, " ");
  if (!clean) return { apellido: "", nombre: "" };
  if (clean.includes(",")) {
    const [a, n] = clean.split(",").map((s) => s.trim());
    return { apellido: a || "", nombre: n || "" };
  }
  const parts = clean.split(" ");
  if (parts.length === 1) return { apellido: parts[0], nombre: "" };
  // Convención del Form: "APELLIDO NOMBRE" → primer token apellido, resto nombre
  return { apellido: parts[0], nombre: parts.slice(1).join(" ") };
};

const cleanDni = (raw: string): string => raw.toString().replace(/\D/g, "");

interface ParsedRow {
  rowNum: number;
  jugador1: { apellido: string; nombre: string; dni: string; telefono: string; ciudad: string };
  jugador2: { apellido: string; nombre: string; dni: string; telefono: string; ciudad: string };
  disponibilidad: string;
  observaciones: string;
  errors: string[];
}

interface ImportResult {
  inscripcionesCreadas: number;
  jugadoresCreados: number;
  errores: { fila: number; motivo: string }[];
  duplicadas: number;
}

export default function Importar() {
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [torneoId, setTorneoId] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<ColumnKey, number>>({} as Record<ColumnKey, number>);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("torneos")
        .select("*")
        .order("fecha_inicio", { ascending: false });
      if (error) toast.error("Error cargando torneos: " + error.message);
      setTorneos(data ?? []);
    })();
  }, []);

  const torneoSel = useMemo(() => torneos.find((t) => t.id === torneoId), [torneos, torneoId]);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });

      if (rows.length < 2) {
        toast.error("El archivo está vacío o no tiene datos.");
        return;
      }

      const hdrs = rows[0].map((h) => h?.toString() ?? "");
      setHeaders(hdrs);

      const map = {} as Record<ColumnKey, number>;
      (Object.keys(COLUMN_MATCHERS) as ColumnKey[]).forEach((k) => {
        map[k] = findColumnIndex(hdrs, k);
      });
      setColumnMap(map);

      const required: ColumnKey[] = ["nombre1", "nombre2"];
      const missing = required.filter((k) => map[k] === -1);
      if (missing.length > 0) {
        toast.error(`Faltan columnas obligatorias: ${missing.join(", ")}`);
        setParsed(null);
        return;
      }
      const hasDniCols = map["dni1"] >= 0 && map["dni2"] >= 0;
      if (!hasDniCols) {
        toast("DNI no detectado — se generarán DNIs provisorios. Podrás fusionar después.", { duration: 6000 });
      }

      const data: ParsedRow[] = rows.slice(1).map((row, idx) => {
        const get = (k: ColumnKey) => (map[k] >= 0 ? (row[map[k]] ?? "").toString().trim() : "");
        const j1 = parseApellidoNombre(get("nombre1"));
        const j2 = parseApellidoNombre(get("nombre2"));
        const dni1 = cleanDni(get("dni1"));
        const dni2 = cleanDni(get("dni2"));
        const errors: string[] = [];
        if (!j1.apellido && !j1.nombre) errors.push("Falta nombre del Jugador 1");
        if (!j2.apellido && !j2.nombre) errors.push("Falta nombre del Jugador 2");
        return {
          rowNum: idx + 2,
          jugador1: { ...j1, dni: dni1, telefono: get("whatsapp1"), ciudad: get("ciudad1") },
          jugador2: { ...j2, dni: dni2, telefono: get("whatsapp2"), ciudad: get("ciudad2") },
          disponibilidad: get("disponibilidad"),
          observaciones: get("observaciones"),
          errors,
        };
      }).filter((r) =>
        // Descartar filas completamente vacías
        r.jugador1.apellido || r.jugador1.nombre || r.jugador1.dni ||
        r.jugador2.apellido || r.jugador2.nombre || r.jugador2.dni
      );

      setParsed(data);
      toast.success(`${data.length} filas detectadas`);
    } catch (err: unknown) {
      toast.error("Error leyendo archivo: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleImport = async () => {
    if (!torneoId) {
      toast.error("Elegí un torneo primero");
      return;
    }
    if (!parsed || parsed.length === 0) return;

    setImporting(true);
    const res: ImportResult = { inscripcionesCreadas: 0, jugadoresCreados: 0, errores: [], duplicadas: 0 };

    // Cache de jugadores por DNI ya buscados/creados en esta sesión
    const dniCache = new Map<string, string>();

    let provisionalCounter = Date.now();

    const upsertJugador = async (j: ParsedRow["jugador1"]): Promise<string | null> => {
      const hasDni = !!j.dni;
      const cacheKey = hasDni ? `dni:${j.dni}` : `name:${norm(j.apellido)}:${norm(j.nombre)}`;

      if (dniCache.has(cacheKey)) return dniCache.get(cacheKey)!;

      if (hasDni) {
        const { data: existing } = await supabase
          .from("jugadores")
          .select("id")
          .eq("dni", j.dni)
          .maybeSingle();
        if (existing?.id) {
          dniCache.set(cacheKey, existing.id);
          return existing.id;
        }
      } else {
        // Sin DNI: buscar por nombre+apellido exacto
        const { data: existing } = await supabase
          .from("jugadores")
          .select("id")
          .ilike("apellido", j.apellido)
          .ilike("nombre", j.nombre)
          .maybeSingle();
        if (existing?.id) {
          dniCache.set(cacheKey, existing.id);
          return existing.id;
        }
      }

      const dniToUse = hasDni ? j.dni : `PROV-${++provisionalCounter}`;

      const { data: created, error } = await supabase
        .from("jugadores")
        .insert({
          apellido: j.apellido || "—",
          nombre: j.nombre || "—",
          dni: dniToUse,
          telefono: j.telefono || null,
          club: j.ciudad || null,
        })
        .select("id")
        .single();
      if (error || !created) return null;
      dniCache.set(cacheKey, created.id);
      res.jugadoresCreados++;
      return created.id;
    };

    for (const row of parsed) {
      if (row.errors.length > 0) {
        res.errores.push({ fila: row.rowNum, motivo: row.errors.join("; ") });
        continue;
      }
      const id1 = await upsertJugador(row.jugador1);
      const id2 = await upsertJugador(row.jugador2);
      if (!id1 || !id2) {
        res.errores.push({ fila: row.rowNum, motivo: "No se pudo crear/obtener uno de los jugadores" });
        continue;
      }
      const notas = [
        row.disponibilidad && `Disponibilidad: ${row.disponibilidad}`,
        row.observaciones && `Obs: ${row.observaciones}`,
      ]
        .filter(Boolean)
        .join(" | ");

      const { error } = await supabase.from("inscripciones").insert({
        torneo_id: torneoId,
        jugador1_id: id1,
        jugador2_id: id2,
        disponibilidad_horaria: row.disponibilidad || null,
        observaciones: row.observaciones || null,
        notas: notas || null,
      });
      if (error) {
        if (error.message.includes("idx_inscripciones_pareja_unica")) {
          res.duplicadas++;
        } else {
          res.errores.push({ fila: row.rowNum, motivo: error.message });
        }
        continue;
      }
      res.inscripcionesCreadas++;
    }

    setResult(res);
    setImporting(false);
    toast.success(`Importación finalizada: ${res.inscripcionesCreadas} inscripciones creadas`);
  };

  const reset = () => {
    setParsed(null);
    setHeaders([]);
    setColumnMap({} as Record<ColumnKey, number>);
    setFileName("");
    setResult(null);
  };

  const filasOk = parsed?.filter((r) => r.errors.length === 0).length ?? 0;
  const filasError = parsed?.filter((r) => r.errors.length > 0).length ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar inscriptos</h1>
        <p className="text-sm text-muted-foreground">
          Subí el CSV o Excel para crear las inscripciones masivamente. El DNI es opcional — si falta se genera uno provisorio.
        </p>
      </div>

      {/* Paso 1: Torneo */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline">1</Badge>
            <Label className="font-semibold">Elegí el torneo destino</Label>
          </div>
          <Select value={torneoId} onValueChange={setTorneoId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar torneo..." />
            </SelectTrigger>
            <SelectContent>
              {torneos.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nombre} {t.fecha_inicio && `(${t.fecha_inicio})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {torneoSel && (
            <p className="text-xs text-muted-foreground">
              Las parejas se inscribirán en: <span className="font-medium text-foreground">{torneoSel.nombre}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Paso 2: Archivo */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline">2</Badge>
            <Label className="font-semibold">Subí el archivo (.csv o .xlsx)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="cursor-pointer"
            />
            {fileName && (
              <Button variant="outline" size="sm" onClick={reset}>
                Limpiar
              </Button>
            )}
          </div>
          {fileName && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span className="truncate">{fileName}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paso 3: Detección de columnas */}
      {parsed && headers.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">3</Badge>
              <Label className="font-semibold">Columnas detectadas</Label>
            </div>
            <div className="grid sm:grid-cols-2 gap-1.5 text-xs">
              {(Object.keys(COLUMN_MATCHERS) as ColumnKey[]).map((k) => {
                const idx = columnMap[k];
                const required = ["nombre1", "nombre2"].includes(k);
                return (
                  <div key={k} className="flex items-center gap-2">
                    {idx >= 0 ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    ) : (
                      <AlertCircle className={`h-3.5 w-3.5 shrink-0 ${required ? "text-destructive" : "text-muted-foreground"}`} />
                    )}
                    <span className="font-medium w-28">{k}:</span>
                    <span className="text-muted-foreground truncate">
                      {idx >= 0 ? headers[idx] : required ? "FALTA" : "(opcional)"}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 4: Preview */}
      {parsed && parsed.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">4</Badge>
                <Label className="font-semibold">Vista previa</Label>
              </div>
              <div className="flex gap-2 text-xs">
                <Badge variant="default">{filasOk} listas</Badge>
                {filasError > 0 && <Badge variant="destructive">{filasError} con errores</Badge>}
              </div>
            </div>

            <div className="border rounded-md max-h-[300px] overflow-y-auto">
              <div className="divide-y text-xs">
                {parsed.map((r) => (
                  <div
                    key={r.rowNum}
                    className={`p-2 ${r.errors.length > 0 ? "bg-destructive/5" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground shrink-0">#{r.rowNum}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate">
                          <span className="font-medium">{r.jugador1.apellido} {r.jugador1.nombre}</span>
                          <span className="text-muted-foreground"> ({r.jugador1.dni})</span>
                          <span className="mx-1">+</span>
                          <span className="font-medium">{r.jugador2.apellido} {r.jugador2.nombre}</span>
                          <span className="text-muted-foreground"> ({r.jugador2.dni})</span>
                        </div>
                        {r.disponibilidad && (
                          <div className="text-muted-foreground truncate">⏰ {r.disponibilidad}</div>
                        )}
                        {r.errors.length > 0 && (
                          <div className="text-destructive">⚠ {r.errors.join("; ")}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={handleImport}
              disabled={!torneoId || filasOk === 0 || importing}
              className="w-full"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Importar {filasOk} {filasOk === 1 ? "pareja" : "parejas"}
                </>
              )}
            </Button>
            {!torneoId && (
              <p className="text-xs text-muted-foreground text-center">
                Elegí un torneo en el paso 1 para habilitar la importación.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resultado */}
      {result && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Importación finalizada</AlertTitle>
          <AlertDescription>
            <ul className="space-y-1 mt-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                {result.inscripcionesCreadas} {result.inscripcionesCreadas === 1 ? "inscripción creada" : "inscripciones creadas"}
              </li>
              <li className="flex items-center gap-2">
                <UserPlus className="h-3.5 w-3.5 text-primary" />
                {result.jugadoresCreados} {result.jugadoresCreados === 1 ? "jugador nuevo creado" : "jugadores nuevos creados"}
              </li>
              {result.duplicadas > 0 && (
                <li className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  {result.duplicadas} {result.duplicadas === 1 ? "pareja ya estaba inscripta (omitida)" : "parejas ya estaban inscriptas (omitidas)"}
                </li>
              )}
              {result.errores.length > 0 && (
                <li>
                  <div className="flex items-center gap-2 text-destructive font-medium">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {result.errores.length} {result.errores.length === 1 ? "error" : "errores"}:
                  </div>
                  <ul className="ml-5 mt-1 text-xs text-muted-foreground list-disc">
                    {result.errores.slice(0, 10).map((e, i) => (
                      <li key={i}>Fila #{e.fila}: {e.motivo}</li>
                    ))}
                    {result.errores.length > 10 && <li>...y {result.errores.length - 10} más</li>}
                  </ul>
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
