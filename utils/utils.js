// utils/Utils.js - Utility functions

class Utils {
    /**
     * Generate a random color for player
     * @returns {number} - Hex color as number
     */
    static getRandomColor() {
      // Generate vibrant, distinguishable colors
      const hue = Math.floor(Math.random() * 360);
      return Utils.hslToHex(hue, 100, 50);
    }
  
    /**
     * Convert HSL to Hex (for more vibrant, distinguishable colors)
     * @param {number} h - Hue (0-360)
     * @param {number} s - Saturation (0-100)
     * @param {number} l - Lightness (0-100)
     * @returns {number} - Hex color as number
     */
    static hslToHex(h, s, l) {
      l /= 100;
      const a = s * Math.min(l, 1 - l) / 100;
      const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
      };
      return parseInt(`${f(0)}${f(8)}${f(4)}`, 16);
    }
  }
  
  module.exports = Utils;