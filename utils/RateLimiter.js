// utils/RateLimiter.js - Rate limiting implementation

class RateLimiter {
    /**
     * Create a new rate limiter using token bucket algorithm
     * @param {number} points - Maximum tokens
     * @param {number} duration - Duration in seconds to refill all tokens
     */
    constructor(points, duration) {
      this.points = points;
      this.duration = duration;
      this.tokens = new Map();
    }
    
    /**
     * Try to consume a token for the given ID
     * @param {string} id - Client identifier
     * @returns {boolean} - Whether consumption was successful
     */
    tryConsume(id) {
      const now = Date.now();
      let token = this.tokens.get(id) || { points: this.points, last: now };
      
      // Restore points based on time passed
      const timePassed = now - token.last;
      token.points += (timePassed / 1000) * (this.points / this.duration);
      token.points = Math.min(this.points, token.points);
      token.last = now;
      
      if (token.points >= 1) {
        token.points -= 1;
        this.tokens.set(id, token);
        return true;
      }
      return false;
    }
    
    /**
     * Clear all stored tokens
     */
    clear() {
      this.tokens.clear();
    }
    
    /**
     * Remove tokens for a specific ID
     * @param {string} id - Client identifier
     */
    remove(id) {
      this.tokens.delete(id);
    }
  }
  
  module.exports = RateLimiter;