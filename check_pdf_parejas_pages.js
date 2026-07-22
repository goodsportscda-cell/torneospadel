import fs from 'fs';

const content = fs.readFileSync('C:\\Users\\Hp\\.gemini\\antigravity-ide\\scratch\\pdf_output.txt', 'utf-8');
const lines = content.split('\n');

let currentPage = '';
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const pageMatch = line.match(/Page \((\d+)\) Break/);
  if (pageMatch) {
    currentPage = pageMatch[1];
  }
  if (line.toLowerCase().includes('pareja')) {
    console.log(`Line ${i + 1} (Page ${currentPage}): ${line.trim()}`);
  }
}
