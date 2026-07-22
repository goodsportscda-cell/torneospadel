import fs from 'fs';

const pdfPath = 'C:\\Users\\Hp\\.gemini\\antigravity-ide\\scratch\\pdf_output.txt';

if (fs.existsSync(pdfPath)) {
  const content = fs.readFileSync(pdfPath, 'utf-8');
  const lines = content.split('\n');
  console.log(`Total lines: ${lines.length}`);
  
  const keywords = ['cabezas de serie', 'sección', 'sorteo', 'diagrama', 'llave campeonato', 'colocación', 'zona'];
  const matches = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (i < 4000) continue;
    const line = lines[i];
    for (const kw of keywords) {
      if (line.toLowerCase().includes(kw)) {
        matches.push({ lineNum: i + 1, text: line.trim(), kw });
        break;
      }
    }
  }
  
  console.log(`Found ${matches.length} matching lines.`);
  console.log("\nSome matches:");
  for (const m of matches) {
    console.log(`- L${m.lineNum} (${m.kw}): ${m.text}`);
  }
} else {
  console.log("PDF text not found");
}
