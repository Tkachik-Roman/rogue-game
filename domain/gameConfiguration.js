export const gameConfiguration = {
    // Настройки Игрового Мира
    levels: 21,
    roomsPerLevel: 9,
    inventorySlots: 9,
    
    // Характеристики Персонажа
    player: {
      health: 1000,
      maxHealth: 1000,
      agility: 10,
      strength: 10
    },
    
    // Типы Противников (Зомби, Вампир, Привидение, Огр, Змей-маг)
    enemies: {
      zombie: { char: 'z', color: 'green', health: 20, agility: 2, strength: 5, hostility: 5 },
      vampire: { char: 'v', color: 'red', health: 20, agility: 10, strength: 5, hostility: 10 },
      ghost: { char: 'g', color: 'white', health: 5, agility: 10, strength: 2, hostility: 2 },
      ogre: { char: 'o', color: 'yellow', health: 30, agility: 3, strength: 20, hostility: 5 },
      snakeMage: { char: 's', color: 'white', health: 15, agility: 20, strength: 10, hostility: 10 }
    },
    
    // Типы Предметов
    items: {
      treasure: { char: '$', color: 'gold' },
      food: { char: '%', color: 'cyan' },
      potion: { char: '!', color: 'blue' },
      scroll: { char: '?', color: 'magenta' },
      weapon: { char: '|', color: 'red' }
    },
    
    // Символы Карты
    map: {
      wall: '#',
      floor: '.',
      door: '+',
      stairsDown: '>',
      stairsUp: '<'
    }
  };