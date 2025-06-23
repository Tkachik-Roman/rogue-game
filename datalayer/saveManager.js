import fs from 'fs';
import path from 'path';
import { Enemy, Item, Room, Level, Character } from '../domain/entities.js';
import { gameConfiguration } from '../domain/gameConfiguration.js';

export class SaveManager {
  constructor(savePath = 'saves') {
    this.savePath = savePath;
    this.ensureSaveDirectory();
  }

  ensureSaveDirectory() {
    if (!fs.existsSync(this.savePath)) {
      fs.mkdirSync(this.savePath);
    }
  }

  saveGame(game, slot = 'Автосохранение') {
    const data = {
      player: {
        x: game.player.x,
        y: game.player.y,
        health: game.player.health,
        maxHealth: game.player.maxHealth,
        agility: game.player.agility,
        strength: game.player.strength,
        inventory: game.player.inventory,
        currentWeapon: game.player.currentWeapon,
        skipTurn: game.player.skipTurn || false
      },
      currentLevel: game.currentLevel,
      levels: game.levels.map(level => ({
        width: level.width,
        height: level.height,
        depth: level.depth,
        rooms: level.rooms.map(room => ({
          x: room.x,
          y: room.y,
          width: room.width,
          height: room.height,
          entities: room.entities.map(entity => ({
            type: entity.type,
            x: entity.x,
            y: entity.y,
            health: entity.health,
            maxHealth: entity.maxHealth,
            agility: entity.agility,
            strength: entity.strength,
            hostility: entity.hostility
          })),
          items: room.items.map(item => ({
            type: item.type,
            x: item.x,
            y: item.y,
            ...(item.type === 'treasure' && { value: item.value }),
            ...(item.type === 'food' && { health: item.health }),
            ...((item.type === 'potion' || item.type === 'scroll') && { 
              stat: item.stat,
              value: item.value
            }),
            ...(item.type === 'weapon' && { value: item.value })
          })),
          connections: room.connections.map(connectedRoom => 
            level.rooms.indexOf(connectedRoom)
          )
        })),
        corridors: level.corridors.map(corridor => ({
          x: corridor.x,
          y: corridor.y
        })),
        startRoom: level.rooms.indexOf(level.startRoom),
        exitRoom: level.rooms.indexOf(level.exitRoom),
        exitPosition: level.exitPosition
      })),
      stats: game.stats
    };

    fs.writeFileSync(
      path.join(this.savePath, `${slot}.json`),
      JSON.stringify(data, null, 2)
    );
  }

  loadGame(game, slot = 'Автосохранение') {
    try {
      const filePath = path.join(this.savePath, `${slot}.json`);
      if (!fs.existsSync(filePath)) {
        console.error('Файл сохранения не найден:', filePath);
        return false;
      }

      const data = JSON.parse(fs.readFileSync(filePath));
      
      // Инициализация игрока
      game.player = new Character(
        data.player.x || 0,
        data.player.y || 0,
        data.player.health || gameConfiguration.player.health,
        data.player.maxHealth || gameConfiguration.player.maxHealth,
        data.player.agility || gameConfiguration.player.agility,
        data.player.strength || gameConfiguration.player.strength,
      );

      game.player.skipTurn = data.player.skipTurn || false;
      
      // Восстановление инвентаря
      game.player.inventory = {
        weapons: (data.player.inventory?.weapons || []).map(w => 
          new Item('weapon', w.x, w.y, { value: w.value })
        ),
        food: (data.player.inventory?.food || []).map(f => 
          new Item('food', f.x, f.y, { health: f.health })
        ),
        potions: (data.player.inventory?.potions || []).map(p => 
          new Item('potion', p.x, p.y, { 
            stat: p.stat, 
            value: p.value,
            duration: p.duration 
          })
        ),
        scrolls: (data.player.inventory?.scrolls || []).map(s => 
          new Item('scroll', s.x, s.y, { 
            stat: s.stat, 
            value: s.value 
          })
        ),
        treasures: data.player.inventory?.treasures || 0
      };
      
      // Восстановление текущего оружия
      game.player.currentWeapon = data.player.currentWeapon 
        ? new Item(
            data.player.currentWeapon.type,
            data.player.currentWeapon.x,
            data.player.currentWeapon.y,
            { value: data.player.currentWeapon.value }
          )
        : null;
      
      game.currentLevel = data.currentLevel || 0;
      game.stats = data.stats || {
        treasures: 0,
        enemiesDefeated: 0,
        foodConsumed: 0,
        potionsUsed: 0,
        scrollsRead: 0,
        hits: 0,
        misses: 0,
        steps: 0
      };
      
      // Восстановление уровней
      game.levels = (data.levels || []).map(levelData => {
        const level = new Level(
          levelData.width || game.width,
          levelData.height || game.height,
          levelData.depth || 1
        );
        
        // Восстановление комнат
        level.rooms = (levelData.rooms || []).map(roomData => {
          const room = new Room(
            roomData.x || 0, 
            roomData.y || 0, 
            roomData.width || 10, 
            roomData.height || 10
          );
          
          room.entities = (roomData.entities || []).map(entityData => {
            const enemy = new Enemy(
              entityData.type || 'zombie',
              entityData.x || 0,
              entityData.y || 0
            );
            enemy.health = entityData.health || 20;
            enemy.maxHealth = entityData.maxHealth || 20;
            enemy.agility = entityData.agility || 2;
            enemy.strength = entityData.strength || 5;
            enemy.hostility = entityData.hostility || 5;
            return enemy;
          });
          
          room.items = (roomData.items || []).map(itemData => {
            if (itemData.type === 'stairsDown') {
              return {
                type: 'stairsDown',
                x: itemData.x,
                y: itemData.y,
                char: gameConfiguration.map.stairsDown,
                color: '#FFFFFF'
              };
            }
            
            const options = {
              ...(itemData.value !== undefined && { value: itemData.value }),
              ...(itemData.health !== undefined && { health: itemData.health }),
              ...(itemData.stat !== undefined && { stat: itemData.stat }),
              ...(itemData.duration !== undefined && { duration: itemData.duration })
            };
            return new Item(
              itemData.type || 'food',
              itemData.x || 0,
              itemData.y || 0,
              options
            );
          });
          
          return room;
        });
        
        // Восстановление коридоров
        level.corridors = (levelData.corridors || []).map(corridorData => ({
          x: corridorData.x,
          y: corridorData.y,
          contains: (xPos, yPos) => xPos === corridorData.x && yPos === corridorData.y
        }));
        
        // Восстановление связей между комнатами
        levelData.rooms?.forEach((roomData, index) => {
          const room = level.rooms[index];
          roomData.connections?.forEach(connectedRoomIndex => {
            if (connectedRoomIndex >= 0 && connectedRoomIndex < level.rooms.length) {
              room.addConnection(level.rooms[connectedRoomIndex]);
            }
          });
        });
        
        // Восстановление стартовой и конечной комнат
        if (levelData.startRoom >= 0 && levelData.startRoom < level.rooms.length) {
          level.startRoom = level.rooms[levelData.startRoom];
        } else {
          level.startRoom = level.rooms[0];
        }
        
        if (levelData.exitRoom >= 0 && levelData.exitRoom < level.rooms.length) {
          level.exitRoom = level.rooms[levelData.exitRoom];
        } else {
          level.exitRoom = level.rooms[level.rooms.length - 1];
        }
        
        level.exitPosition = levelData.exitPosition || { x: 0, y: 0 };
        
        return level;
      });
      
      return true;
    } catch (error) {
      console.error('Не удалось загрузить игру:', error);
      return false;
    }
  }

  getSaveFiles() {
    try {
      return fs.readdirSync(this.savePath)
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch {
      return [];
    }
  }
}