/**
 * Gera uma cor aleatória para o jogador
 * @returns {number} Cor em formato hexadecimal
 */
function getRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  const color = hslToHex(hue, 100, 50);
  // Garantir que o valor seja um número hexadecimal válido
  return parseInt(color.toString(16).padStart(6, '0'), 16);
}

/**
 * Converte HSL para hexadecimal
 * @param {number} h - Matiz (0-360)
 * @param {number} s - Saturação (0-100)
 * @param {number} l - Luminosidade (0-100)
 * @returns {number} Cor em formato hexadecimal
 */
function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return parseInt(`${f(0)}${f(8)}${f(4)}`, 16);
}

module.exports = {
  getRandomColor,
  hslToHex
}; 