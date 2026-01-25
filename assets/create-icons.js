const fs = require('fs');
const { createCanvas } = require('canvas');

function createIcon(size, filename, text, bgColor, fgColor) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);
  
  // Text
  ctx.fillStyle = fgColor;
  ctx.font = `bold ${size/2}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size/2, size/2);
  
  // Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filename, buffer);
  console.log(`Created ${filename}`);
}

function createSplash(width, height, filename, bgColor, text, fgColor) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);
  
  // Text
  ctx.fillStyle = fgColor;
  ctx.font = `bold ${height/10}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width/2, height/2);
  
  // Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filename, buffer);
  console.log(`Created ${filename}`);
}

// Create all assets
createIcon(1024, 'icon.png', 'B', '#6C63FF', '#FFFFFF');
createIcon(1024, 'adaptive-icon.png', 'B', '#6C63FF', '#FFFFFF');
createIcon(48, 'favicon.png', 'B', '#6C63FF', '#FFFFFF');
createSplash(1242, 2688, 'splash.png', '#1A1A2E', 'Braille Tutor', '#6C63FF');

console.log('All assets created successfully!');
