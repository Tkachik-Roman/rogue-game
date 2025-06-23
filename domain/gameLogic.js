import { Character, Item } from './entities.js';
import { LevelGenerator } from './levelGenerator.js';
import { gameConfiguration } from './gameConfiguration.js';

export class Game {
  constructor(width = 120, height = 40, render = null) {
    this.width = width;
    this.height = height;  
    this.currentLevel = 0;
    this.levels = [];
    this.player = null;
    this.gameOver = false;
    this.victory = false;
    this.render = render;
    // Статистика игрока
    this.stats = {
      treasures: 0,
      enemiesDefeated: 0,
      foodConsumed: 0,
      potionsUsed: 0,
      scrollsRead: 0,
      hits: 0,
      misses: 0,
      steps: 0
    };
  }
  
  // Инициализация новой игры
  init() {
    this.currentLevel = 0;
    this.levels = [];
    this.player = new Character(
      0, 0,
      gameConfiguration.player.health,
      gameConfiguration.player.maxHealth,
      gameConfiguration.player.agility,
      gameConfiguration.player.strength
    );
    this.gameOver = false;
    this.victory = false;
    
    // Генерация первого уровня (первая карта игры)
    this.generateLevel();
    
    // Размещение персонажа в стартовой комнате
    const startPos = this.getCurrentLevel().startRoom.getRandomPosition();
    this.player.x = startPos.x;
    this.player.y = startPos.y;
  }
  
  // Создание нового уровня
  generateLevel() {
    const level = LevelGenerator.generate(this.width, this.height, this.currentLevel + 1);
    this.levels.push(level);
  }
  
  // Получение текущего уровня
  getCurrentLevel() {
    return this.levels[this.currentLevel];
  }
  
  // Передвижение персонажа по карте
  movePlayer(dx, dy) {
    if (this.gameOver || this.player.skipTurn) {
      this.player.skipTurn = false;
      return false;
    }

    const newX = this.player.x + dx;
    const newY = this.player.y + dy;
    
    // Проверка выхода из уровня
    const exit = this.getCurrentLevel().exitPosition;
    if (newX === exit.x && newY === exit.y) {
      return this.nextLevel();
    }
    
    // Проверка возможности перемещения в указанную позицию
    if (!this.getCurrentLevel().isWalkable(newX, newY)) {
      return false;
    }
    
    // Проверка наличия противников на целевой позиции
    const enemies = this.getCurrentLevel().getEntitiesAt(newX, newY);
    if (enemies.length > 0) {
      const enemy = enemies[0];
      const hit = this.player.attack(enemy);
      if (hit) {
        this.stats.hits++;
        if (enemy.health <= 0) {
          this.getCurrentLevel().removeEntity(enemy);
          this.stats.enemiesDefeated++;
          // Генерирование Сокровища на позиции уничтоженного противника
          const value = Math.floor(enemy.hostility * (enemy.strength + enemy.agility + enemy.maxHealth) / 10);
          const room = this.getCurrentLevel().getRoomAt(enemy.x, enemy.y);
          if (room) {
            room.addItem(new Item('treasure', enemy.x, enemy.y, { value }));
          }
        }
      } else {
        this.stats.misses++;
      }
      
      // Если противник остался жив, он контратакует
      if (enemy.health > 0) {
        const enemyHit = enemy.attack(this.player);
        if (enemyHit) {
          if (this.player.health <= 0) {
            this.gameOver = true;
            if (this.render) {
              this.render.addMessage(this.getGameStatsMessage(false));
              this.render.renderStats();
              this.render.screen.render();
            }
            return false;
          }
        }
      }
      
      return true;
    }
    
    // Проверка наличия предметов на целевой позиции
    const items = this.getCurrentLevel().getItemsAt(newX, newY);
    if (items.length > 0) {
      const item = items[0];
      if (this.player.pickUpItem(item, this.getCurrentLevel())) {
        if (item.type === 'treasure') {
          this.stats.treasures += item.value;
        }
      }
    }
    
    // Перемещение персонажа в целевую позицию
    this.player.x = newX;
    this.player.y = newY;
    this.stats.steps++;
    
    // Перемещение противников
    this.moveEnemies();
    
    return true;
  }
  
  moveEnemies() {
    const level = this.getCurrentLevel();
    
    for (const room of level.rooms) {
      for (const enemy of room.entities) {
        // Проверка нахождения персонажа в зоне агрессии противника
        const dx = Math.abs(this.player.x - enemy.x);
        const dy = Math.abs(this.player.y - enemy.y);
        const distance = Math.max(dx, dy);
        
        // Если персонаж в зоне агрессии, противник переходит в режим преследования персонажа
        if (distance <= enemy.hostility) {      
          enemy.moveTowards(this.player, level);
          
          // Проверка нахождения противника рядом с персонажем после перемещения
          const newDx = Math.abs(this.player.x - enemy.x);
          const newDy = Math.abs(this.player.y - enemy.y);
          if (newDx <= 1 && newDy <= 1) {
            const hit = enemy.attack(this.player);
            if (hit && this.player.health <= 0) {
              this.gameOver = true;
              if (this.render) {
                this.render.addMessage(this.getGameStatsMessage(false));
                this.render.renderStats();
                this.render.screen.render();
              }
              return
            }
          }
        }
      }
    }
  }

  // Переход персонажа на следующий уровень
  nextLevel() {

    // Проверка того, является ли текущий уровень последним
    if (this.currentLevel + 1 >= gameConfiguration.levels) {
      this.victory = true;
      this.gameOver = true;

      if (this.render) {
        this.render.addMessage(this.getGameStatsMessage(true));
        this.render.renderStats();
      }
      return true;
    }
    
    this.currentLevel++;

    if (this.levels.length <= this.currentLevel) {
      this.generateLevel();
    }
    
    // Размещение персонажа в стартовой комнате
    const startPos = this.getCurrentLevel().startRoom.getRandomPosition();
    this.player.x = startPos.x;
    this.player.y = startPos.y;
    
    return true;
  }
  
  // Использование предмета из рюкзака персонажа
  useItem(type) {
    if (this.gameOver) return false;
    
    const inventoryType = type ==='food' ? 'food' : `${type}s`;
    if (this.player.inventory[inventoryType].length > 0) {
      const success = this.player.useItem(type, 0);
      if (success) {
        switch (type) {
          case 'food': this.stats.foodConsumed++; break;
          case 'potion': this.stats.potionsUsed++; break;
          case 'scroll': this.stats.scrollsRead++; break;
        }
      }
      return success;
    }
    return false;
  }
  
  // Статистика персонажа
  getPlayerStats() {
    return {
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      agility: this.player.agility,
      strength: this.player.strength,
      weapon: this.player.currentWeapon 
        ? `Оружие (+${this.player.currentWeapon.value})` 
        : 'Пусто',
      treasures: this.stats.treasures,
      level: this.currentLevel + 1
    };
  }
  
  getFullStats() {
    return {
      ...this.stats,
      levelReached: this.currentLevel + 1,
      victory: this.victory
    };
  }

  // Сообщение о победе или проигрыше с детальной статистикой прохождения игры
  getGameStatsMessage(isVictory) {
    const status = isVictory ? 
        `{red-fg}{bold}ПОБЕДА!{/bold}{/red-fg}` : 
        `{red-fg}{bold}Это фиаско, братан!{/bold}{/red-fg}`;
    
    const levelReached = this.currentLevel + 1;
    const conclusion = isVictory ? 
        `Вы достигли финального ${levelReached}-го уровня и собрали ${this.stats.treasures} золота (СОКРОВИЩА). ` :
        `Ваш персонаж пал на ${levelReached}-м уровне, собрав ${this.stats.treasures} золота (СОКРОВИЩА). `;
    
    return `${status} ${conclusion} ` +
        `{underline}Ваши достижения:{/underline} ` +
        `Убито нечисти ${this.stats.enemiesDefeated}; ` +
        `Съедено еды ${this.stats.foodConsumed}; ` +
        `Выпито эликсиров ${this.stats.potionsUsed}; ` +
        `Прочитано свитков ${this.stats.scrollsRead};\n` +
        `Ударов нанесено/пропущено ${this.stats.hits}/${this.stats.misses}; ` +
        `Протоптано шагов ${this.stats.steps}. ` +
        `${isVictory ? '{green-fg}<МОЛОДЧИНА!>{/green-fg}' : '{yellow-fg}<Слабовато, Попробуйте снова! Удачи Вам!>{/yellow-fg}'}`;
    }

}