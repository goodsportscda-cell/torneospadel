import Tesseract from 'tesseract.js';
import path from 'path';

async function run() {
  const images = [
    'C:\\Users\\Hp\\.gemini\\antigravity-ide\\brain\\e825f6fd-a153-4038-8328-612313823897\\.tempmediaStorage\\media_e825f6fd-a153-4038-8328-612313823897_1784124369686.png',
    'C:\\Users\\Hp\\.gemini\\antigravity-ide\\brain\\e825f6fd-a153-4038-8328-612313823897\\.tempmediaStorage\\media_e825f6fd-a153-4038-8328-612313823897_1784122673404.jpg',
    'C:\\Users\\Hp\\.gemini\\antigravity-ide\\brain\\e825f6fd-a153-4038-8328-612313823897\\.tempmediaStorage\\media_e825f6fd-a153-4038-8328-612313823897_1784125435849.jpg'
  ];

  for (const imgPath of images) {
    console.log(`Processing ${path.basename(imgPath)}...`);
    try {
      const { data: { text } } = await Tesseract.recognize(imgPath, 'spa');
      console.log('--- Extracted Text ---');
      console.log(text);
      console.log('----------------------');
    } catch (e) {
      console.error(`Error processing ${imgPath}:`, e);
    }
  }
}

run();
