import fs from 'fs';
import path from 'path';

const logsDir = 'C:\\Users\\Hp\\.gemini\\antigravity-ide\\brain\\e825f6fd-a153-4038-8328-612313823897\\.system_generated\\logs';
const transcriptPath = path.join(logsDir, 'transcript.jsonl');

if (fs.existsSync(transcriptPath)) {
  const content = fs.readFileSync(transcriptPath, 'utf-8');
  const lines = content.split('\n');
  console.log(`Total transcript steps: ${lines.length}`);
  
  // Let's find user inputs or planner responses containing key terms like "llave" or "cruces" or "APA"
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]) continue;
    try {
      const step = JSON.parse(lines[i]);
      if (step.type === 'USER_INPUT') {
        console.log(`\n--- Step ${step.step_index} (USER) ---`);
        console.log(step.content);
      } else if (step.type === 'PLANNER_RESPONSE') {
        const text = step.content || '';
        if (text.toLowerCase().includes('llave') || text.toLowerCase().includes('cruce') || text.toLowerCase().includes('apa')) {
          console.log(`\n--- Step ${step.step_index} (AGENT RESPONSE) ---`);
          // Print first 500 chars of response
          console.log(text.slice(0, 500) + (text.length > 500 ? '...' : ''));
        }
      }
    } catch (e) {
      // skip
    }
  }
} else {
  console.log(`Transcript not found at ${transcriptPath}`);
}
