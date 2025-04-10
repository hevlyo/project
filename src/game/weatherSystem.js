const config = require('../config/gameConfig');

class WeatherSystem {
  constructor(io) {
    this.io = io;
    this.currentWeather = null;
    this.WEATHER_EVENTS = [
      {
        type: 'RAIN',
        duration: 60000,
        effects: { friction: 0.8, visibility: 0.7 }
      },
      {
        type: 'FOG',
        duration: 45000,
        effects: { visibility: 0.4 }
      },
      {
        type: 'STORM',
        duration: 30000,
        effects: { windForce: 0.2, friction: 0.6, visibility: 0.5 }
      },
      {
        type: 'SUNSHINE',
        duration: 90000,
        effects: { speedBoost: 1.2, visibility: 1.2 }
      }
    ];
  }

  start() {
    this.scheduleNextWeatherEvent();
  }

  scheduleNextWeatherEvent() {
    const delay = 60000 + Math.random() * 120000; // 1-3 minutos
    
    setTimeout(() => {
      if (this.currentWeather) {
        this.endWeatherEvent();
      }
      
      this.startRandomWeatherEvent();
      this.scheduleNextWeatherEvent();
    }, delay);
  }

  startRandomWeatherEvent() {
    const eventIndex = Math.floor(Math.random() * this.WEATHER_EVENTS.length);
    const weatherEvent = this.WEATHER_EVENTS[eventIndex];
    
    this.currentWeather = {
      ...weatherEvent,
      startTime: Date.now(),
      endTime: Date.now() + weatherEvent.duration
    };
    
    this.io.emit('weatherEvent', { 
      type: weatherEvent.type, 
      duration: weatherEvent.duration,
      effects: weatherEvent.effects
    });
    
    setTimeout(() => {
      this.endWeatherEvent();
    }, weatherEvent.duration);
  }

  endWeatherEvent() {
    if (this.currentWeather) {
      this.io.emit('weatherEnded', { type: this.currentWeather.type });
      this.currentWeather = null;
    }
  }
}

module.exports = WeatherSystem; 