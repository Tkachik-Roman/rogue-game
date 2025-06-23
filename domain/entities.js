import { gameConfiguration } from './gameConfiguration.js';

// Сущность Персонаж
export class Character {
  constructor(x, y, health, maxHealth, agility, strength) {
    this.x = x;
    this.y = y;
    this.health = health;
    this.maxHealth = maxHealth;
    this.agility = agility;
    this.strength = strength;
    this.inventory = {
      weapons: [],
      food: [],
      potions: [],
      scrolls: [],
      treasures: 0
    };
    this.currentWeapon = null;
    this.skipTurn = false;
  }

  // Перемещение Персонажа по Уровню
  move(dx, dy, level) {
    const newX = this.x + dx;
    const newY = this.y + dy;
    
    // Проверка доступности новой позиции
    if (level.isWalkable(newX, newY)) {
      this.x = newX;
      this.y = newY;
      return true;
    }
    return false;
  }

  // Добавление Предметов в Рюкзак Персонажа
  pickUpItem(item, level) {
    if (item.type === 'treasure') {
      this.inventory.treasures += item.value;
      level.removeItem(item);
      return true;
    }

    // Создание динамического названия массива, куда будет помещен подобранный предмет
    const inventoryType = item.type === 'food' ? 'food' : `${item.type}s`;
    if (this.inventory[inventoryType].length < gameConfiguration.inventorySlots) {
      this.inventory[inventoryType].push(item);
      level.removeItem(item);
      return true;
    }
    return false;
  }

  // Использование Предметов из Рюкзака Персонажа
  useItem(type, index) {
    const inventoryType = type ==='food' ? 'food' : `${type}s`;
    if (index >= 0 && index < this.inventory[inventoryType].length) {
      const item = this.inventory[inventoryType][index];
      
      switch (type) {
        case 'food':
          this.health = Math.min(this.maxHealth, this.health + item.health);
          this.inventory.food.splice(index, 1);
          break;
          
        case 'potion':
          // Временное повышение характеристики персонажа в результате использования эликсира
          this[item.stat] += item.value;
          setTimeout(() => {
            this[item.stat] -= item.value;
            if (item.stat === 'maxHealth' && this.health > this.maxHealth) {
              this.health = this.maxHealth;
            }
          }, item.duration);
          this.inventory.potions.splice(index, 1);
          break;
          
        case 'scroll':
          // Постоянное повышение характеристики персонажа в результате использования свитка
          this[item.stat] += item.value;
          if (item.stat === 'maxHealth') {
            this.health += item.value;
          }
          this.inventory.scrolls.splice(index, 1);
          break;
          
        case 'weapon':
          // Смена текущего оружия
          if (this.currentWeapon) {
            this.inventory.weapons.push(this.currentWeapon);
          }
          this.currentWeapon = item;
          this.inventory.weapons.splice(index, 1);
          break;
      }
      
      return true;
    }
    return false;
  }

  // Атака Персонажа Противника
  attack(enemy) {
    // 1 этап расчета удара - проверка на попадание исходя из ловкости персонажа и его противника
    const hitChance = this.agility / (this.agility + enemy.agility);
    if (Math.random() > hitChance) return false;
    
    // 2 этап - расчет базового урона на основе силы персонажа и модификаторов (оружия)
    const baseDamage = this.strength + (this.currentWeapon ? this.currentWeapon.value : 0);
    const damage = Math.max(1, Math.floor(baseDamage * (0.8 + Math.random() * 0.4)));
    
    // 3 этап - нанесение урона противнику
    enemy.health -= damage;
    return true;
  }
}

// Сущность Противник
export class Enemy {
  constructor(type, x, y) {
    const enemyConfig = gameConfiguration.enemies[type];
    this.type = type;
    this.char = enemyConfig.char;
    this.color = enemyConfig.color;
    this.x = x;
    this.y = y;
    this.health = enemyConfig.health;
    this.maxHealth = enemyConfig.health;
    this.agility = enemyConfig.agility;
    this.strength = enemyConfig.strength;
    this.hostility = enemyConfig.hostility;
    this.specialAbility = this.getSpecialAbility(type);
    this.hasAttacked = false;
  }

  // Уникальные Способности Различных Типов Противника
  getSpecialAbility(type) {
    switch (type) {
      // Вампир отнимает некоторое количество максимального здоровья персонажа при своей успешной атаке
      case 'vampire':
        return {
          onHit: (player) => {
            player.maxHealth -= 1;
            player.health = Math.min(player.health, player.maxHealth);
          }
        };
      // Привидение периодически с вероятностью 40% становится невидимым
      case 'ghost':
        return {
          isInvisible: () => Math.random() < 0.4
        };
      // Огр после каждой атаки отдыхает 1 ход
      case 'ogre':
        return {
          isResting: false,
          afterAttack: () => {
            this.specialAbility.isResting = true;
            setTimeout(() => {
              this.specialAbility.isResting = false;
            }, 1000);
          }
        };
      // Змей-маг после каждой своей успешной атаки с вероятностью 20% может усыпить персонажа на 1 ход
      case 'snakeMage':
        return {
          onHit: (player) => {
            if (Math.random() < 0.2) {
              player.skipTurn = true;
            }
          }
        };
      default:
        return {};
    }
  }

  // Паттерны Передвижения Противников по Комнате
  moveTowards(player, level) {
    if (this.type === 'ghost' && this.specialAbility.isInvisible()) {
      // Призрак телепортируется случайным образом, когда невидим
      const possiblePositions = level.getEmptyPositionsInRoom(this.x, this.y);
      if (possiblePositions.length > 0) {
        const { x, y } = possiblePositions[Math.floor(Math.random() * possiblePositions.length)];
        this.x = x;
        this.y = y;
      }
      return;
    }

    if (this.type === 'ogre' && this.specialAbility.isResting) {
      return;
    }

    // Когда начинается преследование персонажа, все монстры двигаются по одному паттерну
    const dx = Math.sign(player.x - this.x);
    const dy = Math.sign(player.y - this.y);
    
    // Змей-маг пытается сначала ходить по карте по диагонали
    if (this.type === 'snakeMage' && level.isWalkable(this.x + dx, this.y + dy)) {
      this.x += dx;
      this.y += dy;
    } else {
      if (Math.random() < 0.5 && level.isWalkable(this.x + dx, this.y)) {
        this.x += dx;
      } else if (level.isWalkable(this.x, this.y + dy)) {
        this.y += dy;
      }
    }
  }

  // Атака Противника Персонажа
  attack(player) {
    // Если противник огр и он отдыхает после первой своей атаки, атаки не будет
    if (this.type === 'ogre' && this.specialAbility.isResting) return false;
    
    // Вампир при первой своей атаке всегда промахивается
    if (this.type === 'vampire' && !this.hasAttacked) {
      this.hasAttacked = true;
      return false;
    }

    // Проверка, что змей-маг уже один раз атаковал. Без проверки будет усыплять персонажа бесконечно
    if (this.type === 'snakeMage' && this.hasAttacked) {
      return false;
    }

    // Расчет шанса попадания исходя из ловкости противника и персонажа
    const hitChance = this.agility / (this.agility + player.agility);
    if (Math.random() > hitChance) return false;
    
    const damage = Math.max(1, Math.floor(this.strength * (0.8 + Math.random() * 0.4)));
    player.health -= damage;
    
    // Применение специфических способностей противника в момент попадания или после атаки
    if (this.specialAbility.onHit) {
      this.specialAbility.onHit(player);
    }

    // После успешной атаки пометка, что змей-маг уже атаковал
    if (this.type === 'snakeMage') {
      this.hasAttacked = true;
    }

    if (this.specialAbility.afterAttack) {
      this.specialAbility.afterAttack();
    }
    
    return true;
  }
}

// Сущность Предмет
export class Item {
  constructor(type, x, y, options = {}) {
    if (!type) {
      throw new TypeError("Символ предмета должен быть определен");
    }
    this.type = type;
    this.x = x;
    this.y = y;
    const itemConfig = gameConfiguration.items[type];
    this.char = itemConfig.char;
    this.color = itemConfig.color;
    
    // Установка характеристик предмета исходя из его типа
    switch (type) {
      case 'treasure':
        this.value = options.value || Math.floor(10 + Math.random() * 20);
        break;
      case 'food':
        this.health = options.health || Math.floor(5 + Math.random() * 10);
        break;
      case 'potion':
        this.stat = options.stat || ['maxHealth', 'agility', 'strength'][Math.floor(Math.random() * 3)];
        this.value = options.value || Math.floor(2 + Math.random() * 3);
        this.duration = options.duration || 10000;
        break;
      case 'scroll':
        this.stat = options.stat || ['maxHealth', 'agility', 'strength'][Math.floor(Math.random() * 3)];
        this.value = options.value || Math.floor(1 + Math.random() * 2);
        break;
      case 'weapon':
        this.value = options.value || Math.floor(3 + Math.random() * 5);
        break;
    }
  }
}

// Сущность Комната
export class Room {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.entities = [];
    this.items = [];
    this.connections = [];
  }

  // Добавление Персонажа или Противника
  addEntity(entity) {
    this.entities.push(entity);
  }

  // Добавление Предмета
  addItem(item) {
    this.items.push(item);
  }

  // Установление Связи Между Комнатами
  addConnection(room) {
    if (!this.connections.includes(room)) {
      this.connections.push(room);
    }
  }

  // Получение Случайной Точки (координата x, y) Внутри Комнаты
  getRandomPosition() {
    return {
      x: this.x + 1 + Math.floor(Math.random() * (this.width - 2)),
      y: this.y + 1 + Math.floor(Math.random() * (this.height - 2))
    };
  }

  // Проверка Нахождения Случайной Точки в Пределах Комнаты
  contains(x, y) {
    return x >= this.x && x < this.x + this.width &&
           y >= this.y && y < this.y + this.height;
  }
}

// Сущность Уровень Игры
export class Level {
  constructor(width, height, depth) {
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.rooms = [];
    this.corridors = [];
    this.startRoom = null;
    this.exitRoom = null;
    this.exitPosition = null;
  }

  addRoom(room) {
    this.rooms.push(room);
  }

  // Добавление Коридора на Уровень
  addCorridor(corridor) {
    this.corridors.push(corridor);
  }

  // Проверка Возможности Перемещения Персонажа по Заданным Координатам
  isWalkable(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }

    // Проверка принадлежности позиции комнате
    for (const room of this.rooms) {
      if (room.contains(x, y)) {
        return true;
      }
    }

    // Проверка принадлежности позиции коридору
    for (const corridor of this.corridors) {
      if (corridor.contains(x, y)) {
        return true;
      }
    }

    return false;
  }

  // Получение Комнаты по Координатам Позиции
  getRoomAt(x, y) {
    for (const room of this.rooms) {
      if (room.contains(x, y)) {
        return room;
      }
    }
    return null;
  }

  // Получение Сущностей по Координатам Позиции
  getEntitiesAt(x, y) {
    const entities = [];
    for (const room of this.rooms) {
      if (room.contains(x, y)) {
        for (const entity of room.entities) {
          if (entity.x === x && entity.y === y) {
            entities.push(entity);
          }
        }
      }
    }
    return entities;
  }

  // Получение Предметов по Координатам Позиции
  getItemsAt(x, y) {
    const items = [];
    for (const room of this.rooms) {
      if (room.contains(x, y)) {
        for (const item of room.items) {
          if (item.x === x && item.y === y) {
            items.push(item);
          }
        }
      }
    }
    return items;
  }

  // Удаление Сущности из Уровня Игры
  removeEntity(entity) {
    for (const room of this.rooms) {
      const index = room.entities.indexOf(entity);
      if (index !== -1) {
        room.entities.splice(index, 1);
        return;
      }
    }
  }

  // Удаление Предмета из Уровня Игры
  removeItem(item) {
    for (const room of this.rooms) {
      const index = room.items.indexOf(item);
      if (index !== -1) {
        room.items.splice(index, 1);
        return;
      }
    }
  }

  // Получение Пустых Позиций Внутри Комнаты по переданным координатам
  getEmptyPositionsInRoom(x, y) {
    const room = this.getRoomAt(x, y);
    if (!room) return [];

    const positions = [];
    for (let ry = room.y + 1; ry < room.y + room.height - 1; ry++) {
      for (let rx = room.x + 1; rx < room.x + room.width - 1; rx++) {
        const entities = this.getEntitiesAt(rx, ry);
        const items = this.getItemsAt(rx, ry);
        if (entities.length === 0 && items.length === 0) {
          positions.push({ x: rx, y: ry });
        }
      }
    }
    return positions;
  }
}