import blessed from 'blessed';

export class InputHandler {
  constructor(game, render, ui) {
    this.game = game;
    this.render = render;
    this.ui = ui;
    this.isMenuOpen = false;
    this.setupControls();
  }

  // Установка контроллеров управления игрой
  setupControls() {
    const { screen } = this.render;

    // Удаляем старые обработчики нажатия клавиш перемещения персонажа, если они были
    screen.unkey(['w', 'up']);
    screen.unkey(['s', 'down']);
    screen.unkey(['a', 'left']);
    screen.unkey(['d', 'right']);
    
    // Обработчики событий нажатия клавиш для перемещения персонажа в четырех направлениях
    screen.key(['w', 'up'], () => {
      if (this.isMenuOpen) return;
      this.game.movePlayer(0, -1);
      this.render.render();
    });

    screen.key(['s', 'down'], () => {
      if (this.isMenuOpen) return;
      this.game.movePlayer(0, 1);
      this.render.render();
    });

    screen.key(['a', 'left'], () => {
      if (this.isMenuOpen) return;
      this.game.movePlayer(-1, 0);
      this.render.render();
    });

    screen.key(['d', 'right'], () => {
      if (this.isMenuOpen) return;
      this.game.movePlayer(1, 0);
      this.render.render();
    });

    // Контроллеры для включения меню разных предметов из рюкзака персонажа
    screen.key(['h'], () => {
      if (this.isMenuOpen) return;
      this.showInventoryMenu('weapon');
    });

    screen.key(['j'], () => {
      if (this.isMenuOpen) return;
      this.showInventoryMenu('food');
    });

    screen.key(['k'], () => {
      if (this.isMenuOpen) return;
      this.showInventoryMenu('potion');
    });

    screen.key(['e'], () => {
      if (this.isMenuOpen) return;
      this.showInventoryMenu('scroll');
    });
  }
  
  showInventoryMenu(type) {
    if (this.isMenuOpen) return;

    const items = this.game.player.inventory[type === 'food' ? 'food' : `${type}s`];
    if (items.length === 0) return;

    this.isMenuOpen = true;

    // Создание интерфейса меню предмета определенного типа
    const menu = blessed.list({
      parent: this.render.screen,
      top: 'center',
      left: 'center',
      width: '30%',
      height: '50%',
      border: { type: 'line' },
      style: {
        selected: { bg: 'blue' }
      },
      keys: true,
      vi: false,
      items: items.map((item, i) =>
        `${i+1}. ${type}: ${this.getItemDescription(item)}`
      )
    });

    // Назначение клавиш навигации в меню выбора предметов из рюкзака персонажа
    menu.key(['up', 'w'], () => menu.up());
    menu.key(['down', 's'], () => menu.down());
    menu.key(['enter', 'space'], () => {
      this.game.useItem(type, menu.selected);
      menu.destroy();
      this.isMenuOpen = false;
      this.render.render();
    });

    menu.key(['escape'], () => {
      menu.destroy();
      this.isMenuOpen = false;
      this.render.screen.render();
    });

    menu.focus();
    this.render.screen.render();
  }

  // Текстовое описание предмета в зависимости от его свойств и назначения
  getItemDescription(item) {
    if (item.type === 'food') return `Лечит ${item.health} XP`;
    if (item.type === 'potion' || item.type === 'scroll') {
      return `+${item.value} ${item.stat}`;
    }
    if (item.type === 'weapon') return `+${item.value} урона противнику`;
    return '';
  }
}