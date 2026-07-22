import fs from 'fs';

const content = fs.readFileSync('C:\\Users\\Hp\\.gemini\\antigravity-ide\\scratch\\pdf_output.txt', 'utf-8');
const lines = content.split('\n');

// Page 162 starts around line 9605
const startLine = 9605;
const endLine = 9722;

console.log("Analyzing PDF text for 48 couples bracket:");
for (let i = startLine; i <= endLine; i++) {
  const line = lines[i];
  if (line.trim().length > 0) {
    // Print line number and the line, replacing multiple spaces with a single marker to see positions
    console.log(`${String(i).padStart(4, '0')}: ${line}`);
  }
}
