import * as THREE from 'three';

export function createTextTexture(label, accent) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const safeLabel = String(label);

  canvas.width = 512;
  canvas.height = 128;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(8, 16, 20, 0.72)';
  context.strokeStyle = accent;
  context.lineWidth = 6;
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(18, 18, canvas.width - 36, canvas.height - 36, 26);
  } else {
    context.rect(18, 18, canvas.width - 36, canvas.height - 36);
  }
  context.fill();
  context.stroke();

  context.font = '700 48px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 10;
  context.strokeStyle = 'rgba(8, 16, 20, 0.92)';
  context.strokeText(safeLabel, canvas.width / 2, canvas.height / 2 + 2);
  context.fillStyle = '#fff7dd';
  context.fillText(safeLabel, canvas.width / 2, canvas.height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function createDetailBumpTexture(size = 192) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = size;
  canvas.height = size;

  const image = context.createImageData(size, size);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const grain = 120 + Math.floor(Math.random() * 95);
    data[i] = grain;
    data[i + 1] = grain;
    data[i + 2] = grain;
    data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);

  const gradient = context.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.1,
    size * 0.5,
    size * 0.5,
    size * 0.7,
  );
  gradient.addColorStop(0, 'rgba(255,255,255,0.16)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.16)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function createPillarColorTexture(width = 160, height = 384) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;

  const baseGradient = context.createLinearGradient(0, 0, width, 0);
  baseGradient.addColorStop(0, '#4e351f');
  baseGradient.addColorStop(0.5, '#6b4727');
  baseGradient.addColorStop(1, '#4b321d');
  context.fillStyle = baseGradient;
  context.fillRect(0, 0, width, height);

  for (let x = 0; x < width; x += 8) {
    const alpha = 0.06 + (Math.random() * 0.08);
    context.fillStyle = `rgba(255, 214, 166, ${alpha})`;
    context.fillRect(x, 0, 2, height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function createBrassBandTexture(width = 512, height = 64) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;

  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#fff2b8');
  gradient.addColorStop(0.22, '#efc45a');
  gradient.addColorStop(0.5, '#d49f3a');
  gradient.addColorStop(0.78, '#efc45a');
  gradient.addColorStop(1, '#b77e1e');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  for (let x = 0; x < width; x += 14) {
    const alpha = 0.04 + (Math.random() * 0.08);
    context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    context.fillRect(x, 0, 2, height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function createSkyTexture(width = 1024, height = 512) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;

  const verticalGradient = context.createLinearGradient(0, 0, 0, height);
  verticalGradient.addColorStop(0, '#93c2cf');
  verticalGradient.addColorStop(0.42, '#b7dce0');
  verticalGradient.addColorStop(1, '#f4dfb7');
  context.fillStyle = verticalGradient;
  context.fillRect(0, 0, width, height);

  const hazeGradient = context.createRadialGradient(
    width * 0.52,
    height * 0.26,
    width * 0.1,
    width * 0.52,
    height * 0.26,
    width * 0.7,
  );
  hazeGradient.addColorStop(0, 'rgba(255,255,255,0.42)');
  hazeGradient.addColorStop(0.6, 'rgba(255,255,255,0.08)');
  hazeGradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = hazeGradient;
  context.fillRect(0, 0, width, height);

  const sunGradient = context.createRadialGradient(
    width * 0.78,
    height * 0.22,
    width * 0.02,
    width * 0.78,
    height * 0.22,
    width * 0.2,
  );
  sunGradient.addColorStop(0, 'rgba(255, 244, 200, 0.96)');
  sunGradient.addColorStop(0.2, 'rgba(255, 231, 166, 0.5)');
  sunGradient.addColorStop(1, 'rgba(255, 231, 166, 0)');
  context.fillStyle = sunGradient;
  context.fillRect(0, 0, width, height);

  const cloudCount = 14;
  for (let index = 0; index < cloudCount; index += 1) {
    const cloudX = (width * 0.12) + (Math.random() * width * 0.78);
    const cloudY = (height * 0.08) + (Math.random() * height * 0.42);
    const cloudWidth = width * (0.08 + (Math.random() * 0.12));
    const cloudHeight = height * (0.035 + (Math.random() * 0.04));
    const cloudGradient = context.createRadialGradient(
      cloudX,
      cloudY,
      0,
      cloudX,
      cloudY,
      Math.max(cloudWidth, cloudHeight),
    );
    cloudGradient.addColorStop(0, 'rgba(255,255,255,0.34)');
    cloudGradient.addColorStop(0.55, 'rgba(255,255,255,0.14)');
    cloudGradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = cloudGradient;
    context.beginPath();
    context.ellipse(cloudX, cloudY, cloudWidth, cloudHeight, Math.random() * 0.4, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function createArenaPatchTexture(size = 256) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = size;
  canvas.height = size;
  context.clearRect(0, 0, size, size);

  const blotchGradient = context.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.08,
    size * 0.5,
    size * 0.5,
    size * 0.5,
  );
  blotchGradient.addColorStop(0, 'rgba(58, 88, 44, 0.68)');
  blotchGradient.addColorStop(0.52, 'rgba(77, 115, 54, 0.48)');
  blotchGradient.addColorStop(1, 'rgba(32, 40, 24, 0)');
  context.fillStyle = blotchGradient;
  context.fillRect(0, 0, size, size);

  const dirtGradient = context.createRadialGradient(
    size * 0.46,
    size * 0.54,
    size * 0.04,
    size * 0.46,
    size * 0.54,
    size * 0.42,
  );
  dirtGradient.addColorStop(0, 'rgba(134, 108, 64, 0.78)');
  dirtGradient.addColorStop(1, 'rgba(134, 108, 64, 0)');
  context.fillStyle = dirtGradient;
  context.beginPath();
  context.ellipse(size * 0.46, size * 0.54, size * 0.34, size * 0.22, -0.42, 0, Math.PI * 2);
  context.fill();

  for (let index = 0; index < 42; index += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = size * (0.012 + (Math.random() * 0.03));
    const color = Math.random() > 0.6
      ? 'rgba(214, 175, 106, 0.08)'
      : 'rgba(13, 34, 19, 0.16)';
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(x, y, radius, radius * (0.55 + Math.random() * 0.8), Math.random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function createStoneTexture(width = 256, height = 512) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;

  const gradient = context.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, '#3d4345');
  gradient.addColorStop(0.38, '#677173');
  gradient.addColorStop(0.62, '#4b5457');
  gradient.addColorStop(1, '#2f3537');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  for (let x = 0; x < width; x += 16) {
    context.fillStyle = `rgba(255, 255, 255, ${0.02 + (Math.random() * 0.05)})`;
    context.fillRect(x, 0, 3, height);
  }

  for (let y = 0; y < height; y += 28) {
    context.strokeStyle = 'rgba(18, 22, 24, 0.28)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, y + (Math.random() * 4));
    context.lineTo(width, y + (Math.random() * 4));
    context.stroke();
  }

  const cracks = 24;
  for (let index = 0; index < cracks; index += 1) {
    const startX = Math.random() * width;
    const startY = Math.random() * height;
    const segments = 3 + Math.floor(Math.random() * 5);
    context.strokeStyle = 'rgba(14, 16, 17, 0.22)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(startX, startY);
    let cursorX = startX;
    let cursorY = startY;
    for (let segment = 0; segment < segments; segment += 1) {
      cursorX += (Math.random() - 0.5) * 34;
      cursorY += (Math.random() - 0.5) * 42;
      context.lineTo(cursorX, cursorY);
    }
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function disposeMaterial(material) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }

  ['map', 'alphaMap', 'aoMap', 'bumpMap', 'displacementMap', 'emissiveMap', 'metalnessMap', 'normalMap', 'roughnessMap'].forEach((key) => {
    if (material[key]) {
      material[key].dispose();
    }
  });

  material.dispose();
}
