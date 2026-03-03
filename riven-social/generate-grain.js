// Run this script to generate a grain.png texture
// Usage: node generate-grain.js
// Requires: npm install canvas

const { createCanvas } = require('canvas');
const fs = require('fs');

const SIZE = 512;
const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext('2d');

const imageData = ctx.createImageData(SIZE, SIZE);
for (let i = 0; i < imageData.data.length; i += 4) {
  const val = Math.random() * 255;
  imageData.data[i] = val;     // R
  imageData.data[i + 1] = val; // G
  imageData.data[i + 2] = val; // B
  imageData.data[i + 3] = 40;  // A (low opacity)
}
ctx.putImageData(imageData, 0, 0);

const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('./public/grain.png', buffer);
console.log('✅ grain.png generated (512x512)');
