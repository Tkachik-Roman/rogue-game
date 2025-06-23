import { Enemy, Item, Room, Level } from './entities.js';
import { gameConfiguration } from './gameConfiguration.js';

export class LevelGenerator {
  static generate(width, height, depth) {
    const level = new Level(width, height, depth);
    const rooms = [];

    // Базовый размер одной комнаты
    const minRoomSize = Math.floor(Math.min(width, height) / 3);
    const maxRoomSize = Math.floor(Math.min(width, height) / 2);

    let attempts = 0;
    const maxAttempts = 1000;
    
    while (rooms.length < gameConfiguration.roomsPerLevel && attempts < maxAttempts) {
      attempts++;
      // Увеличение минимального размера комнаты
      const roomWidth = minRoomSize + Math.floor(Math.random() * (maxRoomSize - minRoomSize));
      const roomHeight = minRoomSize + Math.floor(Math.random() * (maxRoomSize - minRoomSize));
      const x = Math.floor(Math.random() * (width - roomWidth - 2)) + 1;
      const y = Math.floor(Math.random() * (height - roomHeight - 2)) + 1;
      
      const newRoom = new Room(x, y, roomWidth, roomHeight);
      
      // Проверка наложений (пересечений) создаваемой комнаты с какой-то другой существующей на карте комнатой
      let overlap = false;
      for (const existingRoom of rooms) {
        if (this.roomsOverlap(newRoom, existingRoom)) {
          overlap = true;
          break;
        }
      }

      if (!overlap) {
        rooms.push(newRoom);
        level.addRoom(newRoom);
      }
    }
    
    // Если не удалось разместить все 9 комнат на игровой карте - уменьшение минимального размер комнат
    if (rooms.length < gameConfiguration.roomsPerLevel) {
      const reducedMinSize = Math.floor(minRoomSize * 0.8);
      while (rooms.length < gameConfiguration.roomsPerLevel && attempts < maxAttempts * 2) {
        attempts++;
        
        const roomWidth = reducedMinSize + Math.floor(Math.random() * (maxRoomSize - reducedMinSize));
        const roomHeight = reducedMinSize + Math.floor(Math.random() * (maxRoomSize - reducedMinSize));
        const x = Math.floor(Math.random() * (width - roomWidth - 2)) + 1;
        const y = Math.floor(Math.random() * (height - roomHeight - 2)) + 1;
        
        const newRoom = new Room(x, y, roomWidth, roomHeight);
        
        let overlap = false;
        for (const existingRoom of rooms) {
          if (this.roomsOverlap(newRoom, existingRoom)) {
            overlap = true;
            break;
          }
        }
        
        if (!overlap) {
          rooms.push(newRoom);
          level.addRoom(newRoom);
        }
      }
    }
    
    // Если на игровой карте все еще не хватает комнат (должно быть 9)- размещение недостающих комнат впритык
    if (rooms.length < gameConfiguration.roomsPerLevel) {
      const existingRooms = [...rooms];
      while (rooms.length < gameConfiguration.roomsPerLevel) {
        const roomWidth = minRoomSize;
        const roomHeight = minRoomSize;
        
        // Попытка разместить комнату рядом с существующей комнатой
        const baseRoom = existingRooms[Math.floor(Math.random() * existingRooms.length)];
        let x, y;
        
        // Выбор стороны для размещения комнаты
        const side = Math.floor(Math.random() * 4);
        
        switch (side) {
          case 0: // сверху
            x = baseRoom.x + Math.floor(Math.random() * (baseRoom.width - roomWidth));
            y = baseRoom.y - roomHeight - 1;
            break;
          case 1: // справа
            x = baseRoom.x + baseRoom.width + 1;
            y = baseRoom.y + Math.floor(Math.random() * (baseRoom.height - roomHeight));
            break;
          case 2: // снизу
            x = baseRoom.x + Math.floor(Math.random() * (baseRoom.width - roomWidth));
            y = baseRoom.y + baseRoom.height + 1;
            break;
          case 3: // слева
            x = baseRoom.x - roomWidth - 1;
            y = baseRoom.y + Math.floor(Math.random() * (baseRoom.height - roomHeight));
            break;
        }
        
        // Проверка, что комната не выходит за границы уровня
        if (x >= 1 && y >= 1 && 
          x + roomWidth < width - 1 && 
          y + roomHeight < height - 1) {
          
          const newRoom = new Room(x, y, roomWidth, roomHeight);
          let overlap = false;
          
          for (const existingRoom of rooms) {
            if (this.roomsOverlap(newRoom, existingRoom)) {
              overlap = true;
              break;
            }
          }
          
          if (!overlap) {
            rooms.push(newRoom);
            level.addRoom(newRoom);
            existingRooms.push(newRoom);
          }
        }
      }
    }
    
    // Соединение комнат коридорами
    this.connectRooms(rooms, level);
    
    level.startRoom = rooms[0];
    level.exitRoom = rooms[rooms.length - 1];
    level.exitPosition = level.exitRoom.getRandomPosition();
    
    // Заполнение комнат противниками и предметами
    this.populateLevel(level, depth);
    
    return level;
  }
  
  static roomsOverlap(room1, room2) {
    return room1.x < room2.x + room2.width &&
           room1.x + room1.width > room2.x &&
           room1.y < room2.y + room2.height &&
           room1.y + room1.height > room2.y;
  }
  
  static connectRooms(rooms, level) {
    // Соединение всех комнат минимальным количеством путей
    const connected = new Set([rooms[0]]);
    const connections = [];
    
    while (connected.size < rooms.length) {
      let minDistance = Infinity;
      let bestPair = null;
      
      for (const room1 of connected) {
        for (const room2 of rooms) {
          if (!connected.has(room2)) {
            const dx = (room1.x + room1.width/2) - (room2.x + room2.width/2);
            const dy = (room1.y + room1.height/2) - (room2.y + room2.height/2);
            const distance = dx*dx + dy*dy;
            
            // Если найденное расстояние меньше предыдущего минимума, сохранение наилучшей пары комнат
            if (distance < minDistance) {
              minDistance = distance;
              bestPair = [room1, room2];
            }
          }
        }
      }
      
      if (bestPair) {
        connected.add(bestPair[1]);
        connections.push(bestPair);
        this.createCorridor(bestPair[0], bestPair[1], level);
      }
    }
    
    // Добавление дополнительных коридоров
    const extraConnections = Math.floor(rooms.length / 3);
    for (let i = 0; i < extraConnections; i++) {
      const room1 = rooms[Math.floor(Math.random() * rooms.length)];
      const room2 = rooms[Math.floor(Math.random() * rooms.length)];
      if (room1 !== room2 && !connections.some(pair => 
          (pair[0] === room1 && pair[1] === room2) ||
          (pair[0] === room2 && pair[1] === room1))) {
        this.createCorridor(room1, room2, level);
      }
    }
  }
  
  static createCorridor(room1, room2, level) {
    // Определение центра комнат
    const x1 = room1.x + Math.floor(room1.width / 2);
    const y1 = room1.y + Math.floor(room1.height / 2);
    const x2 = room2.x + Math.floor(room2.width / 2);
    const y2 = room2.y + Math.floor(room2.height / 2);
    
    // Соединение комнат L-образным коридором
    if (Math.random() < 0.5) {
      this.addHorizontalCorridor(x1, x2, y1, level);
      this.addVerticalCorridor(y1, y2, x2, level);
    } else {
      this.addVerticalCorridor(y1, y2, x1, level);
      this.addHorizontalCorridor(x1, x2, y2, level);
    }
    
    // Обеспечение двусторонней связи между комнатами
    room1.addConnection(room2);
    room2.addConnection(room1);
  }
  
  static addHorizontalCorridor(x1, x2, y, level) {
    const startX = Math.min(x1, x2);
    const endX = Math.max(x1, x2);
    
    // Проход по всем клеткам между началом и концом коридора
    for (let x = startX; x <= endX; x++) {
      if (!level.isWalkable(x, y)) {
        level.addCorridor({
          x,
          y,
          contains: (xPos, yPos) => xPos === x && yPos === y });
      }
    }
  }
  
  static addVerticalCorridor(y1, y2, x, level) {
    const startY = Math.min(y1, y2);
    const endY = Math.max(y1, y2);
    
    for (let y = startY; y <= endY; y++) {
      if (!level.isWalkable(x, y)) {
        level.addCorridor({
          x,
          y,
          contains: (xPos, yPos) => xPos === x && yPos === y });
      }
    }
  }
  
  static populateLevel(level, depth) {
    const enemyTypes = Object.keys(gameConfiguration.enemies);
    const itemTypes = Object.keys(gameConfiguration.items).filter(t => t !== 'treasure');
    
    for (const room of level.rooms) {
      if (room === level.startRoom) continue;
      
      // Добавление противников (количество увеличивается с увеличением глубины уровня)
      const enemyCount = 1 + Math.floor(depth / 3) + Math.floor(Math.random() * 2);
      for (let i = 0; i < enemyCount; i++) {
        const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
        const { x, y } = room.getRandomPosition();
        
        // Масштабирование (увеличение) значений характеристик противников с увеличением глубины уровня
        const baseEnemy = gameConfiguration.enemies[enemyType];
        const health = Math.floor(baseEnemy.health * (1 + depth * 0.1));
        const agility = Math.floor(baseEnemy.agility * (1 + depth * 0.05));
        const strength = Math.floor(baseEnemy.strength * (1 + depth * 0.1));
        
        // Создание противника конкретного типа
        const enemy = new Enemy(enemyType, x, y);
        enemy.health = health;
        enemy.maxHealth = health;
        enemy.agility = agility;
        enemy.strength = strength;
        
        room.addEntity(enemy);
      }
      
      // Масштабирование (уменьшение) количества предметов с увеличением глубины уровня
      const itemCount = 2 + Math.floor(Math.random() * 3) - Math.floor(depth / 5);
      for (let i = 0; i < itemCount; i++) {
        const itemType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        const { x, y } = room.getRandomPosition();
        
        let itemOptions = {};
        // Увеличение значений свойств предметов в зависимости от глубины уровня
        if (itemType === 'food') {
          itemOptions.health = Math.floor(5 + Math.random() * 5 * (1 + depth * 0.05));
        } else if (itemType === 'potion' || itemType === 'scroll') {
          itemOptions.value = Math.floor(1 + Math.random() * 2 * (1 + depth * 0.1));
        } else if (itemType === 'weapon') {
          itemOptions.value = Math.floor(3 + Math.random() * 5 * (1 + depth * 0.1));
        }
        
        room.addItem(new Item(itemType, x, y, itemOptions));
      }
    }
    
    level.exitRoom.items.push({
      type: 'stairsDown',
      x: level.exitPosition.x,
      y: level.exitPosition.y,
      char: gameConfiguration.map.stairsDown,
      color: '#FFFFFF'
    });
  }
}