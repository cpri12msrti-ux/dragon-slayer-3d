export enum EnemyType {
  GOBLIN = 'GOBLIN',
  SKELETON = 'SKELETON',
  DRAGON = 'DRAGON'
}

export interface Entity {
  x: number;
  y: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  dead: boolean;
  damage: number;
  xpValue: number;
  id: number;
  state: 'IDLE' | 'CHASE' | 'ATTACK';
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number; // Raw defense stat
  resistance: number; // % reduction
  xp: number;
  level: number;
  xpToNextLevel: number;
}

export interface GameState {
  floor: number;
  messageLog: string[];
  isInventoryOpen: boolean;
  isStatsOpen: boolean;
  isPaused: boolean;
  screen: 'INTRO' | 'GAME' | 'WIN' | 'LOSE';
}