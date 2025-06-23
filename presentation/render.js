import blessed from 'blessed';
import { gameConfiguration } from '../domain/gameConfiguration.js';

export class Render {
  constructor(game) {
    this.game = game;
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Игра Rogue'
    });
    
    // Создание основного игрового контейнера
    this.gameContainer = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: '85%',
      tags: true,
      border: { type: 'line' },
      style: {
        fg: 'white',
        border: { fg: '#f0f0f0' }
      }
    });
    
    // Отображения карты игрового мира
    this.mapDisplay = blessed.box({
      parent: this.gameContainer,
      top: 0,
      left: 0,
      width: '70%',
      height: '100%',
      content: '',
      tags: true,
      style: {
        fg: 'white'
      }
    });
    
    // Отображение статистики игрового процесса
    this.statsDisplay = blessed.box({
      parent: this.gameContainer,
      top: 0,
      right: 0,
      width: '30%',
      height: '38%',
      content: '',
      tags: true,
      border: { type: 'line' },
      style: {
        fg: 'white',
        border: { fg: '#f0f0f0' }
      }
    });
    
    // Отображение предметов в рюкзаке
    this.inventoryDisplay = blessed.box({
      parent: this.gameContainer,
      bottom: 0,
      right: 0,
      width: '30%',
      height: '62%',
      content: '',
      tags: true,
      border: { type: 'line' },
      style: {
        fg: 'white',
        border: { fg: '#f0f0f0' }
      }
    });
    
    // Окно сообщений
    this.messageLog = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: '15%',
      content: '',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      border: { type: 'line' },
      style: {
        fg: 'white',
        border: { fg: '#f0f0f0' }
      }
    });
    
    // Выход из программы клавишей ESC
    this.screen.key(['escape'], () => process.exit(0));
    
    this.visibleCells = new Set();
  }
  
  // Обновление отображения карты игрового мира
  renderMap() {
    const level = this.game.getCurrentLevel();
    const player = this.game.player;
    
    // Расчет видимой области вокруг персонажа
    const visionRadius = 8;
    this.visibleCells.clear();
    
    // Проверка каждой клетки от игрока до радиуса видимости
    for (let y = Math.max(0, player.y - visionRadius); y < Math.min(level.height, player.y + visionRadius); y++) {
      for (let x = Math.max(0, player.x - visionRadius); x < Math.min(level.width, player.x + visionRadius); x++) {
        if (this.hasLineOfSight(player.x, player.y, x, y, level)) {
          this.visibleCells.add(`${x},${y}`);
        }
      }
    }
    
    // Реализация эффекта "тумана войны" - закрытые клетки отображаются пустыми (неизведанные территории)
    let mapStr = '';
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        const coord = `${x},${y}`;
        
        // Если клетка не видна, то эта клетка закрыта туманом войны
        if (!this.visibleCells.has(coord)) {
          mapStr += ' ';
          continue;
        }
        
        if (x === player.x && y === player.y) {
          mapStr += `{green-fg}@{/}`;
          continue;
        }
        
        // Если на клетке присутствует одна из сущностей типа противник, в строку добавляется соотвествующий символ сущности
        const entities = level.getEntitiesAt(x, y);
        if (entities.length > 0) {
          const enemy = entities[0];
          mapStr += `{${enemy.color}-fg}${enemy.char}{/}`;
          continue;
        }
        
        // Добавление символа предмета
        const items = level.getItemsAt(x, y);
        if (items.length > 0) {
          const item = items[0];
          if (item.type === 'stairsDown') {
            mapStr += `{white-fg}${item.char}{/}`;
          } else if (item.type === 'treasure') {
            mapStr += `\x1b[33m${item.char}\x1b[0m`;
          } else {
            mapStr += `{${item.color}-fg}${item.char}{/}`;
          }
          continue;
        }
        
        // Определение того, чем является клетка - стеной или полом
        let isWall = true;
        for (const room of level.rooms) {
          if (room.contains(x, y)) {
            isWall = (x === room.x || x === room.x + room.width - 1 || 
                     y === room.y || y === room.y + room.height - 1);
            break;
          }
        }
        
        if (!isWall) {
          mapStr += gameConfiguration.map.floor;
        } else if (level.isWalkable(x, y)) {
          mapStr += gameConfiguration.map.door;
        } else {
          mapStr += gameConfiguration.map.wall;
        }
      }
      mapStr += '\n';
    }
    
    this.mapDisplay.setContent(mapStr);
  }
  
  hasLineOfSight(x1, y1, x2, y2, level) {
    // Алгоритм Брезенхэма для определения видимой области
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = (x1 < x2) ? 1 : -1;
    const sy = (y1 < y2) ? 1 : -1;
    let err = dx - dy;
    
    // Основная петля построителя линии
    while (true) {
      // Если текущая клетка непроходима и не является позицией персонажа, то прямая линия зрения прервана препятствием
      if (!level.isWalkable(x1, y1) && !(x1 === this.game.player.x && y1 === this.game.player.y)) {
        return false;
      }
      
      if (x1 === x2 && y1 === y2) break;
      
      // Обновление координат и ошибки при каждом шаге, движение вдоль виртуальной линии между начальной и конечной клетками
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x1 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y1 += sy;
      }
    }
    
    return true;
  }
  
  // Обновление отображения статистики персонажа
  renderStats() {
    const stats = this.game.getPlayerStats();
    // Добавление строк статистики 
    let statsStr = `Уровень: ${stats.level}\n`;
    statsStr += `Здоровье: ${stats.health}/${stats.maxHealth}\n`;
    statsStr += `Ловкость: ${stats.agility}\n`;
    statsStr += `Сила: ${stats.strength}\n`;
    statsStr += `Оружие: ${stats.weapon}\n`;
    statsStr += `Сокровища: ${stats.treasures}\n`;
    
    // Индикатор прогресса достижения 21 уровня
    const progress = Math.min(100, Math.floor((this.game.currentLevel / gameConfiguration.levels) * 100));
    statsStr += `Прогресс: ${progress}%\n`;
    statsStr += `[${'='.repeat(progress / 5)}${' '.repeat(20 - progress / 5)}]`;
    
    this.statsDisplay.setContent(statsStr);
  }

  // Обновление отображения предметов в рюкзаке персонажа
  renderInventory() {
      const inventory = this.game.player.inventory;
      let invStr = '{bold}Предметы в рюкзаке{/bold}\n';
      
      // Оружие
      invStr += '{underline}Оружие:{/underline}\n';
      if (inventory.weapons.length > 0) {
          inventory.weapons.forEach((weapon, i) => {
              invStr += `${i+1}. Оружие (+${weapon.value} урона)\n`;
          });
      } else {
          invStr += 'Пусто\n';
      }
      
      // Еда
      invStr += '\n{underline}Еда:{/underline}\n';
      if (inventory.food.length > 0) {
          inventory.food.forEach((food, i) => {
              invStr += `${i+1}. Еда (восстанавливает ${food.health} XP)\n`;
          });
      } else {
          invStr += 'Пусто\n';
      }
      
      // Эликсиры
      invStr += '\n{underline}Эликсиры:{/underline}\n';
      if (inventory.potions.length > 0) {
          inventory.potions.forEach((potion, i) => {
              invStr += `${i+1}. Эликсир (+${potion.value} ${potion.stat})\n`;
          });
      } else {
          invStr += 'Пусто\n';
      }
      
      // Свитки
      invStr += '\n{underline}Свитки:{/underline}\n';
      if (inventory.scrolls.length > 0) {
          inventory.scrolls.forEach((scroll, i) => {
              invStr += `${i+1}. Свиток (+${scroll.value} ${scroll.stat})\n`;
          });
      } else {
          invStr += 'Пусто\n';
      }
      
      // Сокровища
      invStr += `\n{underline}Сокровища:{/underline}\n${inventory.treasures} золота`;
      
      this.inventoryDisplay.setContent(invStr);
  }

  // Добавление нового сообщения в окно сообщений
  addMessage(message) {
      const currentContent = this.messageLog.getContent();
      const newContent = currentContent + `\n${message}`;
      this.messageLog.setContent(newContent);
      this.messageLog.scrollTo(100);
      this.screen.render();
  }
    
  render() {
    this.renderMap();        
    this.renderStats();      
    this.renderInventory();  
    this.screen.render();
  }
  
}