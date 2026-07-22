import fs from 'fs';

const content = fs.readFileSync('C:\\Users\\Hp\\.gemini\\antigravity-ide\\scratch\\pdf_output.txt', 'utf-8');
const lines = content.split('\n');

const startLine = 9620;
const endLine = 9720;

console.log("Analyzing text layout by columns:");
for (let i = startLine; i <= endLine; i++) {
  const line = lines[i].replace(/\r/g, '');
  if (line.trim().length === 0) continue;
  
  // Find all non-space segments and their start indices
  const segments = [];
  const regex = /\S+/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    segments.push({ text: match[0], index: match.index });
  }
  
  const formatted = segments.map(s => `${s.text} (col ${s.index})`).join('  |  ');
  console.log(`Line ${i}: ${formatted}`);
}
