const zones = "ABCDEFGHIJKLMNOP";
const seeds = {};

for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    seeds[i + 1] = `1º${z}`; // 1=1ºA, 16=1ºP
    // Snake for 2nd places: 2ºA is 17, 2ºB is 18... 2ºP is 32
    seeds[i + 17] = `2º${z}`;
}

const matches = [
    [1, 32], [16, 17], [9, 24], [8, 25],
    [5, 28], [12, 21], [13, 20], [4, 29],
    [3, 30], [14, 19], [11, 22], [6, 27],
    [7, 26], [10, 23], [15, 18], [2, 31]
];

console.log("--- STANDARD SNAKE 2 (17=2ºA, 32=2ºP) ---");
matches.forEach((m, i) => {
    console.log(`${i + 33}: ${seeds[m[0]]} vs ${seeds[m[1]]}`);
});

// Let's also try the FAP variant where the snake is inverted for 2nd places
for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    // 2ºP is 17, 2ºA is 32
    seeds[32 - i] = `2º${z}`;
}

console.log("\n--- INVERTED SNAKE (32=2ºA, 17=2ºP) ---");
matches.forEach((m, i) => {
    console.log(`${i + 33}: ${seeds[m[0]]} vs ${seeds[m[1]]}`);
});

