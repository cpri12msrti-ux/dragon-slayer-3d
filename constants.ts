export const SCREEN_WIDTH = 640;
export const SCREEN_HEIGHT = 480;
export const TICK_RATE = 30;
export const FOV = 0.66; // Field of View
export const ROTATION_SPEED = 0.08;
export const MOVE_SPEED = 0.12;

export const MAP_SIZE = 24;

export const TEXTURES = {
  WALL_1: '#4a5568', // Slate 600
  WALL_2: '#2d3748', // Slate 800
  FLOOR: '#1a202c', // Gray 900
  CEILING: '#000000',
  DOOR: '#744210',
};

export const ENEMY_STATS = {
  GOBLIN: {
    hp: 15,
    damage: 2,
    xp: 30,
    speed: 0.04,
    color: '#48bb78', // Green
    scale: 0.6,
  },
  SKELETON: {
    hp: 30,
    damage: 4,
    xp: 40,
    speed: 0.035,
    color: '#e2e8f0', // White/Gray
    scale: 0.7,
  },
  DRAGON: {
    hp: 5000,
    damage: 15, // Low damage relative to HP
    xp: 10000,
    speed: 0.02,
    color: '#9f7aea', // Purple/Red mix handled in render
    scale: 2.5, // Giant
  }
};
