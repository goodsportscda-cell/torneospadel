export type Player = 'p1' | 'p2';

export interface PadelConfig {
  modoDeuce: boolean; // true = Ventaja, false = Punto de Oro
  superTieBreak3erSet: boolean; // true = 3er set es a 10 puntos, false = set normal
  modoSoloSuperTieBreak: boolean; // true = partido de 1 solo super tie break a 10
}

export interface SetScore {
  p1: number;
  p2: number;
}

export interface PadelState {
  nombres: { p1: string; p2: string };
  config: PadelConfig;
  points: { p1: number; p2: number }; // En tiebreak son numeros enteros
  games: { p1: number; p2: number };
  sets: SetScore[];
  currentSet: number;
  server: Player;
  isTieBreak: boolean;
  isSuperTieBreak: boolean;
  winner: Player | null;
  history: PadelState[];
}

export const initialState: PadelState = {
  nombres: { p1: 'Pareja 1', p2: 'Pareja 2' },
  config: { modoDeuce: true, superTieBreak3erSet: true, modoSoloSuperTieBreak: false },
  points: { p1: 0, p2: 0 },
  games: { p1: 0, p2: 0 },
  sets: [],
  currentSet: 1,
  server: 'p1',
  isTieBreak: false,
  isSuperTieBreak: false,
  winner: null,
  history: []
};

// --- Helper Functions ---

const POINTS_MAP = [0, 15, 30, 40]; // Indices 0, 1, 2, 3

export const obtenerTextoPuntaje = (state: PadelState, player: Player): string | number => {
  if (state.isTieBreak || state.isSuperTieBreak) {
    return state.points[player];
  }
  
  const pScore = state.points[player];
  const oScore = state.points[player === 'p1' ? 'p2' : 'p1'];

  if (pScore <= 3 && oScore <= 3) {
    if (pScore === 3 && oScore === 3) return 40; // Deuce real se ve como 40-40 o Iguales, devolvemos 40
    return POINTS_MAP[pScore];
  }

  // Estamos en ventajas
  if (pScore > oScore) return 'AD';
  return '-';
};

const swapServer = (server: Player): Player => (server === 'p1' ? 'p2' : 'p1');

// --- Core Actions ---

export const sumarPunto = (state: PadelState, player: Player): PadelState => {
  if (state.winner) return state; // Juego terminado
  
  const opponent = player === 'p1' ? 'p2' : 'p1';
  let newState: PadelState = JSON.parse(JSON.stringify(state)); // Deep copy simple
  
  // Guardar historia (sin historia anidada)
  const stateSinHistoria = { ...state, history: [] };
  newState.history.push(stateSinHistoria);

  // --- Caso: Solo Super Tie Break ---
  if (newState.config.modoSoloSuperTieBreak) {
    newState.isSuperTieBreak = true;
    newState.points[player]++;
    
    // Rotación de saque 1-2-2
    const totalPoints = newState.points.p1 + newState.points.p2;
    if (totalPoints % 2 === 1) newState.server = swapServer(newState.server);

    // Chequear ganador de partido (a 10, dif de 2)
    if (newState.points[player] >= 10 && newState.points[player] - newState.points[opponent] >= 2) {
      newState.winner = player;
      newState.sets.push({ p1: newState.points.p1, p2: newState.points.p2 });
    }
    return newState;
  }

  // --- Caso: Tie-Break o Super Tie-Break (3er set) ---
  if (newState.isTieBreak || newState.isSuperTieBreak) {
    newState.points[player]++;
    
    // Rotación 1-2-2
    const totalPoints = newState.points.p1 + newState.points.p2;
    if (totalPoints % 2 === 1) newState.server = swapServer(newState.server);
    
    const targetScore = newState.isSuperTieBreak ? 10 : 7;
    
    if (newState.points[player] >= targetScore && newState.points[player] - newState.points[opponent] >= 2) {
      // Ganó el set
      newState.games[player]++;
      newState.sets.push({ p1: newState.games.p1, p2: newState.games.p2 });
      
      // Fin del set/partido
      if (newState.currentSet === 3 || newState.sets.filter(s => s.p1 > s.p2).length === 2 || newState.sets.filter(s => s.p2 > s.p1).length === 2) {
        newState.winner = player; // Ya no hay más sets
      } else {
        // Avanzar al siguiente set
        newState.currentSet++;
        newState.games = { p1: 0, p2: 0 };
        newState.points = { p1: 0, p2: 0 };
        newState.isTieBreak = false;
        newState.isSuperTieBreak = (newState.currentSet === 3 && newState.config.superTieBreak3erSet);
        newState.server = swapServer(state.server); // Cambio de saque normal de inicio de set
      }
    }
    return newState;
  }

  // --- Caso: Juego Regular ---
  const pScore = newState.points[player];
  const oScore = newState.points[opponent];

  if (pScore === 3 && oScore === 3) {
    // Están 40-40
    if (newState.config.modoDeuce) {
      newState.points[player]++; // Pasa a Ventaja (4)
    } else {
      // Punto de Oro -> gana el game directamente
      newState = ganarGame(newState, player);
    }
  } else if (pScore === 4 && oScore === 3) { // Tenia ventaja y gano
    newState = ganarGame(newState, player);
  } else if (pScore === 3 && oScore === 4) { // Oponente tenia ventaja y este jugador ganó
    newState.points[opponent]--; // Vuelven a 40-40 (3-3)
  } else if (pScore === 3 && oScore < 3) { // 40 y gana -> game
    newState = ganarGame(newState, player);
  } else {
    newState.points[player]++; // Suma normal (0->15->30->40)
  }

  return newState;
};

const ganarGame = (state: PadelState, player: Player): PadelState => {
  const opponent = player === 'p1' ? 'p2' : 'p1';
  state.games[player]++;
  state.points = { p1: 0, p2: 0 };
  state.server = swapServer(state.server);

  const pGames = state.games[player];
  const oGames = state.games[opponent];

  if (pGames === 6 && oGames === 6) {
    state.isTieBreak = true;
  } else if ((pGames >= 6 && pGames - oGames >= 2) || pGames === 7) {
    // Gana el set
    state.sets.push({ p1: state.games.p1, p2: state.games.p2 });
    
    // Chequear si ganó el partido (Mejor de 3)
    const p1SetWins = state.sets.filter(s => s.p1 > s.p2).length;
    const p2SetWins = state.sets.filter(s => s.p2 > s.p1).length;

    if (p1SetWins === 2 || p2SetWins === 2) {
      state.winner = p1SetWins === 2 ? 'p1' : 'p2';
    } else {
      // Pasa al siguiente set
      state.currentSet++;
      state.games = { p1: 0, p2: 0 };
      if (state.currentSet === 3 && state.config.superTieBreak3erSet) {
        state.isSuperTieBreak = true;
      }
    }
  }
  return state;
}

export const deshacerPunto = (state: PadelState): PadelState => {
  if (state.history.length === 0) return state;
  const previousState = state.history[state.history.length - 1];
  return {
    ...previousState,
    history: state.history.slice(0, -1) // Remover el último estado consumido
  };
};

export const reiniciarPartido = (state: PadelState): PadelState => {
  return {
    ...initialState,
    nombres: state.nombres,
    config: state.config,
    history: []
  };
};

export const actualizarConfiguracion = (state: PadelState, config: Partial<PadelConfig>, nombres: { p1: string; p2: string }): PadelState => {
  return {
    ...state,
    nombres,
    config: { ...state.config, ...config }
  };
};
