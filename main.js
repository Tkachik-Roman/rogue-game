import { SaveManager } from './datalayer/saveManager.js';
import { Game } from './domain/gameLogic.js';
import { InputHandler } from './presentation/inputHandler.js';
import { Render } from './presentation/render.js';
import { UI } from './presentation/ui.js';

const game = new Game(120, 40);
const render = new Render(game);
game.render = render;
const saveManager = new SaveManager();
const ui = new UI(render.screen);

// Инициализация новой игры при условии отсутствия загрузки сохраненной ранее игры (по умолчанию)
function startGame(loaded = false) {
  if (!loaded) {
    game.init();
  }
  new InputHandler(game, render, ui);
  render.render();
  render.addMessage('Игра началась. Удачи тебе, рогалик!');
}

const saves = saveManager.getSaveFiles();

// Проверка наличия сохраненных игр
if (saves.length > 0) {
  ui.createMenu(
    'Привет! Загрузить игру или начать новую?',
    ['Новая игра', ...saves.map(save => `Загрузить: ${save}`)],
    (item, index) => {
      if (index === 0) {
        startGame();
      } else {
        const success = saveManager.loadGame(game, saves[index - 1]);
        if (success) {
          startGame(true);
          render.addMessage(`Сохраненная игра "${saves[index - 1]}" загружена`);
        } else {
          ui.createMessageBox('Ошибка', 'Загрузить игру не получилось');
          startGame();
        }
      }
    }
  );
} else {
  startGame();
}

// Обработка события 'Выход из игры' Node.js клавиша Esc
process.on('exit', () => {
  saveManager.saveGame(game);
});

// Обработка неперехваченных исключений
process.on('uncaughtException', (err) => {
  ui.createMessageBox('Критическая ошибка', `Ошибка: ${err.message}\nИгра будет закрыта`);
  setTimeout(() => process.exit(1), 3000);
});