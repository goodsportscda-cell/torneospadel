import fs from 'fs';

const pdfPath = 'C:\\Users\\Hp\\.gemini\\antigravity-ide\\scratch\\pdf_output.txt';

if (!fs.existsSync(pdfPath)) {
  console.log("PDF text not found");
  process.exit(1);
}

const content = fs.readFileSync(pdfPath, 'utf-8');
const lines = content.split('\n');

// Find start lines for each size
const sizeLines = [];
for (let size = 6; size <= 48; size++) {
  const regex = new RegExp(`^\\s*${size}\\s+PAREJAS`, 'i');
  let lineNum = -1;
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      lineNum = i;
      break;
    }
  }
  if (lineNum === -1) {
    const altRegex = new RegExp(`PAREJAS\\s+${size}|${size}\\s+PAREJAS`, 'i');
    for (let i = 0; i < lines.length; i++) {
      if (altRegex.test(lines[i])) {
        lineNum = i;
        break;
      }
    }
  }
  sizeLines.push({ size, lineNum });
}

// Extract labels for each size
for (let idx = 0; idx < sizeLines.length; idx++) {
  const { size, lineNum } = sizeLines[idx];
  if (lineNum === -1) {
    console.log(`Size ${size}: Not found`);
    continue;
  }
  
  const startLine = idx === 0 ? 5050 : sizeLines[idx - 1].lineNum;
  const pageLines = lines.slice(startLine, lineNum);
  
  // Extract all strings that look like zone references:
  // e.g. "1º A", "2º B", "3º A", "BYE", or with OCR noise "1 A"
  const rawLabels = [];
  for (const line of pageLines) {
    // Look for patterns like "1º A", "2º B", "BYE", "1° A"
    const matches = line.matchAll(/(?:([1-4])\s*[º°º\s]*\s*([A-P]))|(BYE)/gi);
    for (const m of matches) {
      if (m[3]) {
        rawLabels.push("BYE");
      } else {
        rawLabels.push(`${m[1]}°${m[2].toUpperCase()}`);
      }
    }
  }
  
  // De-duplicate adjacent duplicates that might come from layout lines
  const labels = [];
  for (let i = 0; i < rawLabels.length; i++) {
    if (i === 0 || rawLabels[i] !== rawLabels[i - 1]) {
      labels.push(rawLabels[i]);
    }
  }
  
  // Check if inverted: if the first occurrence of "1°B" is before "1°A"
  const firstA = labels.indexOf("1°A");
  const firstB = labels.indexOf("1°B");
  let inverted = false;
  if (firstB !== -1 && firstA !== -1 && firstB < firstA) {
    inverted = true;
    labels.reverse();
  }
  
  console.log(`\nSize ${size} (${labels.length} slots, inverted: ${inverted}):`);
  console.log(labels.join(", "));
}
