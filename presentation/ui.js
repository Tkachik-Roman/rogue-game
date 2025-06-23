import blessed from 'blessed';

export class UI {
  constructor(screen) {
      this.screen = screen;
  }

  // Создание интерактивного меню
  createMenu(title, items, callback) {
    const menu = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: '70%',
      border: { type: 'line' },
      style: {
        selected: { bg: 'blue', fg: 'white' },
        item: { fg: 'white' },
        border: { fg: '#f0f0f0' }
      },
      items: items,
      title: title,
      keys: true,
      mouse: true
    });

    menu.key(['enter'], () => {
    const selected = menu.getItem(menu.selected);
    callback(selected.content, menu.selected);
    menu.destroy();
    this.screen.render();
    });

    menu.on('select', (item, index) => {
      callback(item, index);
      menu.destroy();
      this.screen.render();
    });

    menu.key(['escape'], () => {
      menu.destroy();
      this.screen.render();
    });

    menu.key(['up', 'w'], () => menu.up());
    menu.key(['down', 's'], () => menu.down());

    menu.focus();
    this.screen.render();
    return menu;
  }

  // Создание окна сообщения
  createMessageBox(title, message) {
    const box = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: '30%',
      border: { type: 'line' },
      style: {
        fg: 'white',
        border: { fg: '#f0f0f0' }
      },
      content: message,
      title: title
    });

    box.key(['escape'], () => {
      box.destroy();
      this.screen.render();
    });

    this.screen.render();
    return box;
  }

}