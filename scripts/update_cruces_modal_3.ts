import fs from 'fs';
import path from 'path';

const filePath = path.join('src', 'pages', 'TorneoIndividualDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');

// 1. Add state variables for Editing Cruces
const stateBlockTarget = `  const [shareFixtureOpen, setShareFixtureOpen] = useState(false);`;
const stateBlockNew = `  const [shareFixtureOpen, setShareFixtureOpen] = useState(false);

  // Edit matches manual state
  const [editCrucesOpen, setEditCrucesOpen] = useState(false);
  const [editingCruces, setEditingCruces] = useState<PartidoInd[]>([]);
  const [savingCruces, setSavingCruces] = useState(false);

  const handleOpenEditCruces = () => {
    // Populate the editing matches array with a deep clone of current fecha's pending matches
    const pendingMatches = partidosDeFecha.filter(p => p.estado === "pendiente");
    setEditingCruces(JSON.parse(JSON.stringify(pendingMatches)));
    setEditCrucesOpen(true);
  };

  const handleSaveCrucesManuales = async () => {
    setSavingCruces(true);
    try {
      const promises = editingCruces.map(p => 
        supabase.from("partidos_individuales").update({
          jugador1_id: p.jugador1_id,
          jugador2_id: p.jugador2_id,
          jugador3_id: p.jugador3_id,
          jugador4_id: p.jugador4_id
        }).eq("id", p.id)
      );
      await Promise.all(promises);
      toast.success("Cruces actualizados manualmente");
      setEditCrucesOpen(false);
      fetchTournamentData();
    } catch (e: any) {
      toast.error("Error al guardar cruces: " + e.message);
    } finally {
      setSavingCruces(false);
    }
  };`;

// 2. Add the button in the UI Header
const buttonTarget = `                {selectedFecha && selectedFecha.estado === "pendiente" && partidosDeFecha.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    onClick={handleCerrarFecha}
                    disabled={!partidosDeFecha.every((p) => p.estado === "finalizado")}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Cerrar Fecha {selectedFechaNum}
                  </Button>
                )}`;

const buttonNew = `                {selectedFecha && selectedFecha.estado === "pendiente" && partidosDeFecha.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                    onClick={handleOpenEditCruces}
                  >
                    <Settings className="h-4 w-4 mr-1.5" />
                    Editar Cruces Manualmente
                  </Button>
                )}

                {selectedFecha && selectedFecha.estado === "pendiente" && partidosDeFecha.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    onClick={handleCerrarFecha}
                    disabled={!partidosDeFecha.every((p) => p.estado === "finalizado")}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Cerrar Fecha {selectedFechaNum}
                  </Button>
                )}`;

// 3. Add the Dialog at the end of the return statement
const dialogTarget = `      </Wrapper>
    </div>
  );
}`;

const dialogNew = `
      {/* Editar Cruces Manualmente */}
      <Dialog open={editCrucesOpen} onOpenChange={setEditCrucesOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cruces Manualmente</DialogTitle>
            <DialogDescription>
              Puedes reasignar qué jugadores van a cada cancha. Guarda los cambios antes de salir.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {editingCruces.map((partido, pIndex) => (
              <div key={partido.id} className="border rounded-xl p-4 bg-muted/20">
                <h4 className="font-semibold mb-4 text-primary">{partido.cancha}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Pareja 1 */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium border-b pb-1">Pareja / Equipo 1</p>
                    <div className="space-y-2">
                      <Select
                        value={partido.jugador1_id || ""}
                        onValueChange={(val) => {
                          const newM = [...editingCruces];
                          newM[pIndex].jugador1_id = val;
                          setEditingCruces(newM);
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Seleccionar Jugador 1" /></SelectTrigger>
                        <SelectContent>
                          {jugadoresInscriptos.map(tj => (
                            <SelectItem key={tj.jugador_id} value={tj.jugador_id}>{tj.jugador?.apellido}, {tj.jugador?.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={partido.jugador2_id || ""}
                        onValueChange={(val) => {
                          const newM = [...editingCruces];
                          newM[pIndex].jugador2_id = val;
                          setEditingCruces(newM);
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Seleccionar Jugador 2" /></SelectTrigger>
                        <SelectContent>
                          {jugadoresInscriptos.map(tj => (
                            <SelectItem key={tj.jugador_id} value={tj.jugador_id}>{tj.jugador?.apellido}, {tj.jugador?.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Pareja 2 */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium border-b pb-1">Pareja / Equipo 2</p>
                    <div className="space-y-2">
                      <Select
                        value={partido.jugador3_id || ""}
                        onValueChange={(val) => {
                          const newM = [...editingCruces];
                          newM[pIndex].jugador3_id = val;
                          setEditingCruces(newM);
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Seleccionar Jugador 3" /></SelectTrigger>
                        <SelectContent>
                          {jugadoresInscriptos.map(tj => (
                            <SelectItem key={tj.jugador_id} value={tj.jugador_id}>{tj.jugador?.apellido}, {tj.jugador?.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={partido.jugador4_id || ""}
                        onValueChange={(val) => {
                          const newM = [...editingCruces];
                          newM[pIndex].jugador4_id = val;
                          setEditingCruces(newM);
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Seleccionar Jugador 4" /></SelectTrigger>
                        <SelectContent>
                          {jugadoresInscriptos.map(tj => (
                            <SelectItem key={tj.jugador_id} value={tj.jugador_id}>{tj.jugador?.apellido}, {tj.jugador?.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {editingCruces.length === 0 && (
              <p className="text-center text-muted-foreground">No hay partidos pendientes en esta fecha para editar.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCrucesOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveCrucesManuales} disabled={savingCruces || editingCruces.length === 0}>
              {savingCruces ? "Guardando..." : "Guardar Cruces"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </Wrapper>
    </div>
  );
}`;

if (!content.includes('const [editCrucesOpen, setEditCrucesOpen] = useState(false);')) {
  if (content.includes(stateBlockTarget)) {
    content = content.replace(stateBlockTarget, stateBlockNew);
    console.log("Success: applied state");
  } else {
    console.log("Error: state block not found");
  }
}

if (content.includes(buttonTarget)) {
  content = content.replace(buttonTarget, buttonNew);
  console.log("Success: applied header button");
} else {
  console.log("Error: header button block not found");
}

if (content.includes(dialogTarget)) {
  content = content.replace(dialogTarget, dialogNew);
  console.log("Success: applied dialog");
} else {
  console.log("Error: dialog block not found");
}

fs.writeFileSync(filePath, content, 'utf-8');
