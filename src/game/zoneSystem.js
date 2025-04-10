const config = require('../config/gameConfig');

class ZoneSystem {
  constructor(io) {
    this.io = io;
    this.zones = [];
  }

  createZone() {
    const zoneTypes = ['MULTIPLIER', 'DANGER', 'SPEED_BOOST', 'LOW_GRAVITY'];
    const type = zoneTypes[Math.floor(Math.random() * zoneTypes.length)];
    
    const newZone = {
      id: `zone-${Date.now()}`,
      type: type,
      position: {
        x: (Math.random() * config.WORLD_SIZE * 2) - config.WORLD_SIZE,
        y: 0.1,
        z: (Math.random() * config.WORLD_SIZE * 2) - config.WORLD_SIZE
      },
      radius: 5 + Math.random() * 10,
      duration: 30000 + Math.random() * 30000,
      createdAt: Date.now()
    };
    
    this.zones.push(newZone);
    this.io.emit('newZone', newZone);
    
    setTimeout(() => {
      this.removeZone(newZone.id);
    }, newZone.duration);
  }

  removeZone(zoneId) {
    const index = this.zones.findIndex(z => z.id === zoneId);
    if (index !== -1) {
      this.zones.splice(index, 1);
      this.io.emit('zoneRemoved', zoneId);
    }
  }

  getActiveZones() {
    return this.zones;
  }

  isPlayerInZone(playerPosition, zone) {
    const distance = Math.sqrt(
      Math.pow(playerPosition.x - zone.position.x, 2) + 
      Math.pow(playerPosition.z - zone.position.z, 2)
    );
    return distance <= zone.radius;
  }

  getZoneEffects(playerPosition) {
    const effects = {};
    
    this.zones.forEach(zone => {
      if (this.isPlayerInZone(playerPosition, zone)) {
        switch(zone.type) {
          case 'MULTIPLIER':
            effects.scoreMultiplier = 2;
            break;
          case 'DANGER':
            effects.damage = 1;
            break;
          case 'SPEED_BOOST':
            effects.speedBoost = 1.5;
            break;
          case 'LOW_GRAVITY':
            effects.gravity = 0.5;
            break;
        }
      }
    });
    
    return effects;
  }
}

module.exports = ZoneSystem; 