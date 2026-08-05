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

// 2. Add the button in the UI (Inside the Fixture tab)
const buttonTarget = `                    <Button onClick={() => handleGenerarFechaRegular(selectedFechaNum)}>
                      <CalendarDays className="h-4 w-4 mr-2" />
                      Generar Cruces por Ranking (Fecha {selectedFechaNum})
                    </Button>`;

const buttonNew = `                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <Button onClick={() => handleGenerarFechaRegular(selectedFechaNum)}>
                        <CalendarDays className="h-4 w-4 mr-2" />
                        Generar Cruces por Regla (Fecha {selectedFechaNum})
                      </Button>
                      <Button variant="outline" onClick={handleOpenEditCruces}>
                        <Settings className="h-4 w-4 mr-2" />
                        Editar Cruces Manualmente
                      </Button>
                    </div>`;

const buttonTarget2 = `                    <Button onClick={handleGenerarFecha1}>
                      <CalendarDays className="h-4 w-4 mr-2" />
                      Generar Fecha 1 (Al Azar)
                    </Button>`;

const buttonNew2 = `                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <Button onClick={handleGenerarFecha1}>
                        <CalendarDays className="h-4 w-4 mr-2" />
                        Generar Fecha 1 (Al Azar)
                      </Button>
                      <Button variant="outline" onClick={handleOpenEditCruces}>
                        <Settings className="h-4 w-4 mr-2" />
                        Editar Cruces Manualmente
                      </Button>
                    </div>`;

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

let foundButton1 = false;
let foundButton2 = false;
let foundDialog = false;

// We already successfully replaced stateBlock in the first run, so let's skip it if it's there.
// If it's not there, we add it. But wait, I didn't replace it because the first error aborted?
// No, the first script logged "Success: applied edit cruces modal" which means it DID write to the file!
// Oh wait, `content.includes(stateBlockTarget)` might have been true, so it replaced it.
// Let's check if the state is already there.
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
  foundButton1 = true;
}

if (content.includes(buttonTarget2)) {
  content = content.replace(buttonTarget2, buttonNew2);
  foundButton2 = true;
}

if (content.includes(dialogTarget)) {
  content = content.replace(dialogTarget, dialogNew);
  foundDialog = true;
}

console.log("Button 1 found:", foundButton1);
console.log("Button 2 found:", foundButton2);
console.log("Dialog found:", foundDialog);

fs.writeFileSync(filePath, content, 'utf-8');
