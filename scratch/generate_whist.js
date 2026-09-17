function checkWhist(schedule) {
    for (let i = 1; i <= 8; i++) {
        let partners = [];
        let opponents = [];
        for (const r of schedule) {
            for (const m of r) {
                if (m[0].includes(i)) {
                    partners.push(m[0][0] === i ? m[0][1] : m[0][0]);
                    opponents.push(...m[1]);
                } else if (m[1].includes(i)) {
                    partners.push(m[1][0] === i ? m[1][1] : m[1][0]);
                    opponents.push(...m[0]);
                }
            }
        }
        if (new Set(partners).size !== 7) return false;
        
        let oppCounts = {};
        for (const op of opponents) oppCounts[op] = (oppCounts[op] || 0) + 1;
        for (let j = 1; j <= 8; j++) {
            if (i !== j && oppCounts[j] !== 2) return false;
        }
    }
    return true;
}

const schedule_new = [];
for (let i = 0; i < 7; i++) {
    const b1 = 8, b2 = 7, b3 = 1, b4 = 3;
    const b5 = 2, b6 = 6, b7 = 4, b8 = 5;
    
    function shift(x, offset) {
        if (x === 8) return 8;
        return ((x - 1 + offset) % 7) + 1;
    }
    
    const m1 = [ [shift(b1, i), shift(b2, i)], [shift(b3, i), shift(b4, i)] ];
    const m2 = [ [shift(b5, i), shift(b6, i)], [shift(b7, i), shift(b8, i)] ];
    schedule_new.push([m1, m2]);
}

console.log("Is new schedule valid?", checkWhist(schedule_new));

for (let idx = 0; idx < schedule_new.length; idx++) {
    const [m1, m2] = schedule_new[idx];
    console.log(`  (p_torneo_id, ${idx+1}, 'Cancha 1', jugadores[${m1[0][0]}], jugadores[${m1[0][1]}], jugadores[${m1[1][0]}], jugadores[${m1[1][1]}], 'pendiente'),`);
    console.log(`  (p_torneo_id, ${idx+1}, 'Cancha 2', jugadores[${m2[0][0]}], jugadores[${m2[0][1]}], jugadores[${m2[1][0]}], jugadores[${m2[1][1]}], 'pendiente')` + (idx === 6 ? ";" : ","));
}
