// Contrat partagé entre le serveur et le client : vues de table, réglages, constantes et règles de la passe.

export const MIN_PLAYERS = 2;
/** La boîte réunit 2 à 6 joueurs. */
export const MAX_PLAYERS = 6;

/** Les huit bestioles du paquet, chacune en huit exemplaires. */
export const ANIMALS = ['cafard', 'chauvesouris', 'mouche', 'crapaud', 'rat', 'scorpion', 'araignee', 'punaise'] as const;
export type Animal = (typeof ANIMALS)[number];
export const COPIES = 8;
export const DECK_SIZE = ANIMALS.length * COPIES;

/** À deux : dix cartes écartées sans les regarder, pas de passe, et l'on perd à cinq bestioles identiques. */
export const DUO_REMOVED = 10;

/** Combien de bestioles identiques devant soi font perdre la partie. */
export function loseAt(players: number): number {
  return players === 2 ? 5 : 4;
}

export function isAnimal(x: unknown): x is Animal {
  return typeof x === 'string' && (ANIMALS as readonly string[]).includes(x);
}

/** Des curiosités pour avatars : aucune n'est une bestiole du paquet, pour ne jamais prêter à confusion. */
export const AVATARS = ['hibou', 'escargot', 'papillon', 'coccinelle', 'herisson', 'tortue', 'pieuvre', 'lezard', 'abeille', 'champignon', 'coquillage', 'crabe'] as const;
export const EMOTES = ['😏', '🤥', '😱', '🤔', '👀', '😂', '🙈', '🪳'] as const;
export const TAUNTS = ['Tu mens.', 'Regarde-moi dans les yeux.', 'Parole de cafard !', 'Je le sens mal…', 'Cadeau !', 'Ça grouille ici.', 'Moi ? Jamais.'] as const;

export const THINK_OPTIONS = [0, 30, 60] as const;
export type ThinkTime = (typeof THINK_OPTIONS)[number];

export interface Settings {
  /** Temps pour décider, en secondes (0 : sans limite). Le temps écoulé, le pilote automatique joue. */
  think: ThinkTime;
}

export type PlayerStatus = 'lobby' | 'playing' | 'spectator';

/** Les cartes face visible devant un joueur, rangées par bestiole. Rien sur l'ordre où elles sont arrivées. */
export type Piles = Record<Animal, number>;

export function emptyPiles(): Piles {
  return Object.fromEntries(ANIMALS.map((a) => [a, 0])) as Piles;
}

export interface PlayerStats {
  /** Annonces fausses. */
  lies: number;
  /** Receveurs trompés par ses annonces. */
  fooled: number;
  /** Bonnes réponses. */
  reads: number;
  /** Mauvaises réponses. */
  misreads: number;
  /** Cartes regardées puis refilées. */
  passes: number;
}

export interface PlayerView {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  isHost: boolean;
  connected: boolean;
  autopilot: boolean;
  status: PlayerStatus;
  /** Le nombre de cartes en main se voit autour de la table. Leur contenu, jamais. */
  handCount: number;
  piles: Piles;
}

/**
 * give : le joueur actif choisit une carte, un joueur et une annonce.
 * answer : le receveur répond, ou regarde la carte.
 * peek : le receveur a regardé la carte, il doit la refiler.
 * reveal : la carte est retournée.
 */
export type RoundPhase = 'give' | 'answer' | 'peek' | 'reveal';

export interface Reveal {
  card: Animal;
  claim: Animal;
  claimerId: string;
  receiverId: string;
  /** Ce que le receveur a répondu : true pour « c'est vrai ». */
  said: boolean;
  /** L'annonce était-elle vraie ? */
  truth: boolean;
  /** Le receveur a-t-il vu juste ? */
  right: boolean;
  takerId: string;
  /** La partie s'arrête sur ce coup : quatre bestioles identiques, ou plus rien à donner. */
  loserId: string | null;
  endReason: EndReason | null;
}

export type EndReason = 'collection' | 'empty';

export interface RoundView {
  number: number;
  phase: RoundPhase;
  /** Celui qui a lancé la carte de ce tour. */
  activeId: string;
  /** Celui dont on attend une décision (null pendant la révélation). */
  actorId: string | null;
  turnEndsAt: number;
  /** Le trajet en cours : qui a eu la carte, dans l'ordre. Le dernier la tient. Rien des tours précédents. */
  path: string[];
  /** Ceux qui ont vu la carte. */
  seenIds: string[];
  /** Seulement l'annonce en cours. */
  claim: Animal | null;
  claimerId: string | null;
  /** La bestiole en jeu : seulement pour ceux qui l'ont vue, puis pour tous à la révélation. */
  card: Animal | null;
  /** À qui tu peux donner ou refiler la carte, si c'est à toi de le faire. */
  targets: string[];
  /** Tu peux regarder la carte pour la refiler : quelqu'un ne l'a pas encore vue, et l'on est plus de deux. */
  canPeek: boolean;
  reveal: Reveal | null;
  revealEndsAt: number;
  /** Avant cette date, la carte se retourne encore : on ne passe pas à la suite. */
  revealMinAt: number;
  readyIds: string[];
}

export interface FinalEntry {
  id: string;
  name: string;
  avatar: string;
  loser: boolean;
  piles: Piles;
  handCount: number;
  stats: PlayerStats;
}

export interface FinalView {
  loserId: string;
  reason: EndReason;
  /** La bestiole de trop, quand la collection est complète. */
  animal: Animal | null;
  entries: FinalEntry[];
}

export interface RoomView {
  code: string;
  phase: 'lobby' | 'playing' | 'finished';
  me: string;
  hostId: string;
  settings: Settings;
  /** Les joueurs, dans l'ordre de la table, puis les spectateurs. */
  players: PlayerView[];
  round: RoundView | null;
  /** Ta main, à toi seul, rangée par bestiole. */
  hand: Animal[] | null;
  /** À deux, combien de cartes ont été écartées (jamais lesquelles). */
  removed: number;
  /** Combien de bestioles identiques font perdre à cette table. */
  loseAt: number;
  final: FinalView | null;
  serverNow: number;
}

export type Ack<T = unknown> = (res: { ok: boolean; error?: string; data?: T }) => void;

/** Trie une main dans l'ordre du paquet, pour qu'elle ne trahisse pas l'ordre d'arrivée des cartes. */
export function sortHand(hand: Animal[]): Animal[] {
  return [...hand].sort((a, b) => ANIMALS.indexOf(a) - ANIMALS.indexOf(b));
}
