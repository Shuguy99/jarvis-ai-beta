const { createCanvas } = require("canvas");

const SIZE = 256;
const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext("2d");

// Dark background with blue tint
ctx.fillStyle = "#0a0e1a";
ctx.fillRect(0, 0, SIZE, SIZE);

// Outer glow
const glowGrad = ctx.createRadialGradient(128, 128, 60, 128, 128, 128);
glowGrad.addColorStop(0, "rgba(0, 220, 255, 0.08)");
glowGrad.addColorStop(1, "rgba(0, 220, 255, 0)");
ctx.fillStyle = glowGrad;
ctx.fillRect(0, 0, SIZE, SIZE);

// Outer ring
ctx.beginPath();
ctx.arc(128, 128, 110, 0, Math.PI * 2);
ctx.strokeStyle = "rgba(0, 220, 255, 0.7)";
ctx.lineWidth = 3;
ctx.stroke();

// Middle ring (dashed)
ctx.beginPath();
ctx.setLineDash([12, 8]);
ctx.arc(128, 128, 90, 0, Math.PI * 2);
ctx.strokeStyle = "rgba(0, 220, 255, 0.5)";
ctx.lineWidth = 2;
ctx.stroke();
ctx.setLineDash([]);

// Inner ring
ctx.beginPath();
ctx.arc(128, 128, 70, 0, Math.PI * 2);
ctx.strokeStyle = "rgba(0, 220, 255, 0.6)";
ctx.lineWidth = 2.5;
ctx.stroke();

// Core ring
ctx.beginPath();
ctx.arc(128, 128, 50, 0, Math.PI * 2);
ctx.strokeStyle = "rgba(0, 220, 255, 0.4)";
ctx.lineWidth = 1.5;
ctx.stroke();

// Tick marks on outer ring
for (let i = 0; i < 36; i++) {
  const angle = (i * 10 * Math.PI) / 180;
  const inner = i % 3 === 0 ? 102 : 106;
  const outer = 110;
  ctx.beginPath();
  ctx.moveTo(128 + Math.cos(angle) * inner, 128 + Math.sin(angle) * inner);
  ctx.lineTo(128 + Math.cos(angle) * outer, 128 + Math.sin(angle) * outer);
  ctx.strokeStyle = i % 3 === 0 ? "rgba(0, 220, 255, 0.9)" : "rgba(0, 220, 255, 0.4)";
  ctx.lineWidth = i % 3 === 0 ? 2 : 1;
  ctx.stroke();
}

// Central core glow
const coreGrad = ctx.createRadialGradient(128, 128, 0, 128, 128, 30);
coreGrad.addColorStop(0, "rgba(0, 255, 255, 0.9)");
coreGrad.addColorStop(0.4, "rgba(0, 220, 255, 0.5)");
coreGrad.addColorStop(1, "rgba(0, 220, 255, 0)");
ctx.fillStyle = coreGrad;
ctx.beginPath();
ctx.arc(128, 128, 30, 0, Math.PI * 2);
ctx.fill();

// Central core dot
ctx.beginPath();
ctx.arc(128, 128, 8, 0, Math.PI * 2);
ctx.fillStyle = "#00ddff";
ctx.fill();

// Save as PNG
const fs = require("fs");
const outPath = require("path").join(__dirname, "icon.png");
const buf = canvas.toBuffer("image/png");
fs.writeFileSync(outPath, buf);
console.log(`Icon saved: ${outPath} (${buf.length} bytes)`);

// Also try to write as .ico placeholder (just renamed PNG — real ICO needs conversion on Windows)
const icoPath = require("path").join(__dirname, "icon.ico");
fs.writeFileSync(icoPath, buf);
console.log(`ICO placeholder saved: ${icoPath}`);