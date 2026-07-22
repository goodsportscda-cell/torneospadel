import fs from 'fs';

const pdfPath = 'C:\\Users\\Hp\\.gemini\\antigravity-ide\\scratch\\pdf_output.txt';

if (fs.existsSync(pdfPath)) {
  const content = fs.readFileSync(pdfPath, 'utf-8');
  const lines = content.split('\n');
  
  console.log("Locating tournament sizes in PDF text:");
  
  for (let size = 6; size <= 48; size++) {
    const regex = new RegExp(`^\\s*${size}\\s+PAREJAS`, 'i');
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        console.log(`- Size ${size}: found on line ${i + 1}`);
        found = true;
        break;
      }
    }
    if (!found) {
      // Try alternative formats like "6 Parejas" or "PAREJAS 6"
      const altRegex = new RegExp(`PAREJAS\\s+${size}|${size}\\s+PAREJAS`, 'i');
      for (let i = 0; i < lines.length; i++) {
        if (altRegex.test(lines[i])) {
          console.log(`- Size ${size} (Alt): found on line ${i + 1}`);
          found = true;
          break;
        }
      }
    }
  }
} else {
  console.log("PDF text not found");
}
