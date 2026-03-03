const { createCanvas } = require('canvas');
const fs = require('fs');

const size = 512;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

for (let x = 0; x < size; x++) {
  for (let y = 0; y < size; y++) {
    const v = Math.floor(Math.random() * 256);
    ctx.fillStyle = `rgba(${v},${v},${v},0.16)`;
    ctx.fillRect(x, y, 1, 1);
  }
}

const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('public/grain.png', buffer);
console.log('grain.png generated');
