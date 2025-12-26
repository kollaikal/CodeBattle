
export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  isAlive: boolean;
  wpm: number;
  accuracy: number;
  health: number;
  avatar: string;
  isBot: boolean;
}

export interface HighScore {
  wpm: number;
  accuracy: number;
}

export interface CodeSnippet {
  code: string;
  language: string;
  repo: string;
  fileName: string;
  gitUrl: string;
}

export interface AIGuard {
  id: string;
  x: number;
  y: number;
  targetId: string;
  speed: number;
}

export enum GameState {
  LOBBY = 'LOBBY',
  DROPPING = 'DROPPING',
  PLAYING = 'PLAYING',
  GAMEOVER = 'GAMEOVER'
}

export interface GameStats {
  rank: number;
  totalPlayers: number;
  wpm: number;
  accuracy: number;
  timeSurvived: number;
}
