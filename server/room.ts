// Une table de Cockroach Poker : salon, donne, cartes glissées, passes, révélations et fin de partie.
import crypto from 'node:crypto';
import {
  ANIMALS,
  AVATARS,
  COPIES,
  DUO_REMOVED,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TAUNTS,
  THINK_OPTIONS,
  emptyPiles,
  isAnimal,
  loseAt,
  sortHand,
  type Animal,
  type EndReason,
  type FinalView,
  type Piles,
  type PlayerStats,
  type PlayerStatus,
  type Reveal,
  type RoomView,
  type RoundPhase,
  type Settings,
  type ThinkTime,
} from '../shared/protocol';
import { NEUTRAL, botTurn, randomPersonality, type BotView, type Personality } from './bots';

const BOT_NAMES = ['Linné', 'Buffon', 'Mme Merian', 'Lamarck', 'Réaumur', 'Cuvier', 'Mlle Fabre', 'Audubon'];
const MAX_MEMBERS = 16;
/** Délai laissé à un joueur déconnecté avant que le pilote automatique ne prenne le relais. */
const GRACE_MS = 20_000;
/** Mode accéléré pour les tests locaux (CR_FAST=1) : bots et chronos quasi instantanés. */
const FAST = process.env.CR_FAST === '1';
/** La carte se retourne et le verdict tombe : personne ne doit couper ce moment. */
const REVEAL_MIN_MS = FAST ? 0 : 2_600;
/** Ensuite, on enchaîne tout seul si personne ne touche à rien. */
const REVEAL_MS = FAST ? 120 : 4_200;
/** Le coup qui termine la partie mérite qu'on s'y attarde. */
const REVEAL_END_MS = FAST ? 150 : 6_500;

export interface Player {
  id: string;
  token: string;
  name: string;
  avatar: string;
  isBot: boolean;
  personality: Personality;
  sockets: Set<string>;
  connected: boolean;
  disconnectedAt: number;
  left: boolean;
  status: PlayerStatus;
  hand: Animal[];
  piles: Piles;
  stats: PlayerStats;
}

export interface Round {
  number: number;
  phase: RoundPhase;
  activeId: string;
  /** La carte en jeu, connue du seul serveur et de ceux qui l'ont regardée. */
  card: Animal | null;
  path: string[];
  seen: Set<string>;
  claim: Animal | null;
  claimerId: string | null;
  actorId: string | null;
  turnEndsAt: number;
  botActAt: number;
  reveal: Reveal | null;
  revealEndsAt: number;
  revealMinAt: number;
  ready: Set<string>;
}

function uid(): string {
  return crypto.randomBytes(9).toString('base64url');
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function emptyStats(): PlayerStats {
  return { lies: 0, fooled: 0, reads: 0, misreads: 0, passes: 0 };
}

export class Room {
  readonly code: string;
  hostId = '';
  phase: 'lobby' | 'playing' | 'finished' = 'lobby';
  settings: Settings = { think: 0 };
  players: Player[] = [];
  round: Round | null = null;
  final: FinalView | null = null;
  /** À deux, les cartes écartées : elles ne sortent jamais du serveur. */
  removed: Animal[] = [];
  lastActive = Date.now();
  onChange: () => void = () => {};
  onEmote: (playerId: string, text: string) => void = () => {};

  private roundCount = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(code: string) {
    this.code = code;
  }

  // ───────────────────────────── Membres ─────────────────────────────

  get(id: string | undefined | null): Player | undefined {
    return id ? this.players.find((p) => p.id === id) : undefined;
  }

  findByToken(playerId: unknown, token: unknown): Player | undefined {
    if (typeof playerId !== 'string' || typeof token !== 'string') return undefined;
    const p = this.get(playerId);
    return p && !p.isBot && p.token === token ? p : undefined;
  }

  get seated(): Player[] {
    return this.players.filter((p) => p.status !== 'spectator');
  }

  get humansOnline(): number {
    return this.players.filter((p) => !p.isBot && p.connected).length;
  }

  /** Les joueurs de la partie, dans l'ordre de la table. */
  playing(): Player[] {
    return this.players.filter((p) => p.status === 'playing');
  }

  get loseAt(): number {
    return loseAt(this.phase === 'lobby' ? this.seated.length : this.playing().length);
  }

  touch(): void {
    this.lastActive = Date.now();
  }

  private uniqueName(name: string): string {
    const taken = new Set(this.players.map((p) => p.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; i < 99; i++) {
      const candidate = `${name.slice(0, 13)} ${i}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return name;
  }

  private makePlayer(name: string, avatar: string, isBot: boolean, status: PlayerStatus): Player {
    return {
      id: uid(),
      token: uid() + uid(),
      name: this.uniqueName(name),
      avatar,
      isBot,
      personality: isBot ? randomPersonality() : NEUTRAL,
      sockets: new Set(),
      connected: isBot,
      disconnectedAt: Date.now(),
      left: false,
      status,
      hand: [],
      piles: emptyPiles(),
      stats: emptyStats(),
    };
  }

  addHuman(name: string, avatar: string): Player | string {
    if (this.players.length >= MAX_MEMBERS) return 'Cette table est pleine.';
    const seatFree = this.phase === 'lobby' && this.seated.length < MAX_PLAYERS;
    if (this.phase === 'lobby' && !seatFree) return `La table est complète (${MAX_PLAYERS} joueurs maximum).`;
    const p = this.makePlayer(name, avatar, false, seatFree ? 'lobby' : 'spectator');
    this.players.push(p);
    if (!this.hostId) this.hostId = p.id;
    return p;
  }

  addBot(by: string): string | undefined {
    if (by !== this.hostId) return "Seul l'hôte peut ajouter des bots.";
    if (this.phase !== 'lobby') return 'On ajoute des bots dans le salon.';
    if (this.seated.length >= MAX_PLAYERS) return `La table est complète (${MAX_PLAYERS} joueurs maximum).`;
    const used = new Set(this.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${this.players.length + 1}`;
    const usedAvatars = new Set(this.players.map((p) => p.avatar));
    const free = AVATARS.filter((a) => !usedAvatars.has(a));
    const pool = free.length ? free : AVATARS;
    this.players.push(this.makePlayer(name, pool[crypto.randomInt(pool.length)], true, 'lobby'));
    return undefined;
  }

  kick(by: string, target: string): { sockets: string[] } | string {
    if (by !== this.hostId) return "Seul l'hôte peut retirer un joueur.";
    if (this.phase !== 'lobby') return 'On ne peut retirer un joueur que dans le salon.';
    const p = this.get(target);
    if (!p || p.id === by) return 'Joueur introuvable.';
    this.players = this.players.filter((x) => x.id !== p.id);
    return { sockets: [...p.sockets] };
  }

  leave(id: string): void {
    const p = this.get(id);
    if (!p) return;
    p.sockets.clear();
    p.connected = false;
    p.disconnectedAt = Date.now();
    if (this.phase === 'lobby' || p.status === 'spectator') this.players = this.players.filter((x) => x.id !== id);
    else p.left = true;
    if (this.hostId === id) this.transferHost();
  }

  private transferHost(): void {
    const next = this.players.find((p) => !p.isBot && !p.left && p.connected) ?? this.players.find((p) => !p.isBot && !p.left);
    this.hostId = next?.id ?? '';
  }

  connect(p: Player, socketId: string): void {
    p.sockets.add(socketId);
    p.connected = true;
    p.left = false;
    if (!this.hostId || !this.get(this.hostId) || this.get(this.hostId)?.left) this.hostId = p.id;
  }

  disconnect(id: string | undefined, socketId: string): void {
    const p = this.get(id);
    if (!p) return;
    p.sockets.delete(socketId);
    if (p.sockets.size === 0) {
      p.connected = false;
      p.disconnectedAt = Date.now();
    }
  }

  isAuto(p: Player): boolean {
    return p.isBot || p.left || (!p.connected && Date.now() - p.disconnectedAt >= GRACE_MS);
  }

  updateSettings(by: string, payload: Record<string, unknown>): string | undefined {
    if (by !== this.hostId) return "Seul l'hôte peut changer les réglages.";
    if (this.phase !== 'lobby') return 'Les réglages se changent dans le salon.';
    if ((THINK_OPTIONS as readonly unknown[]).includes(payload.think)) this.settings.think = payload.think as ThinkTime;
    return undefined;
  }

  // ───────────────────────────── Partie ─────────────────────────────

  start(by: string): string | undefined {
    if (by !== this.hostId) return "Seul l'hôte peut lancer la partie.";
    if (this.phase !== 'lobby') return 'La partie est déjà lancée.';
    const seated = this.seated;
    if (seated.length < MIN_PLAYERS) return `Il faut au moins ${MIN_PLAYERS} joueurs (ajoute un bot si besoin).`;
    const spectators = this.players.filter((p) => p.status === 'spectator');
    this.players = [...shuffle([...seated]), ...spectators];
    for (const p of seated) {
      p.status = 'playing';
      p.hand = [];
      p.piles = emptyPiles();
      p.stats = emptyStats();
      if (p.isBot) p.personality = randomPersonality();
    }
    // Le paquet entier, battu. À deux, dix cartes sont écartées sans que personne ne les voie.
    const deck = shuffle(ANIMALS.flatMap((a) => Array.from({ length: COPIES }, () => a)));
    this.removed = seated.length === 2 ? deck.splice(0, DUO_REMOVED) : [];
    // Le livret fait commencer le plus jeune : ici, le sort désigne qui ouvre. La donne part de lui,
    // et tant pis si 64 ne se divise pas : certains ont une carte de plus, c'est normal.
    const order = this.playing();
    const first = crypto.randomInt(order.length);
    deck.forEach((card, i) => order[(first + i) % order.length].hand.push(card));
    for (const p of order) p.hand = sortHand(p.hand);
    this.phase = 'playing';
    this.roundCount = 0;
    this.final = null;
    this.startRound(order[first].id);
    return undefined;
  }

  restart(by: string): string | undefined {
    if (by !== this.hostId) return "Seul l'hôte peut relancer une partie.";
    if (this.phase === 'lobby') return undefined;
    this.clearTimer();
    this.players = this.players.filter((p) => !p.left);
    let seats = 0;
    for (const p of this.players) {
      p.status = seats < MAX_PLAYERS ? 'lobby' : 'spectator';
      if (p.status === 'lobby') seats++;
      p.hand = [];
      p.piles = emptyPiles();
    }
    this.phase = 'lobby';
    this.round = null;
    this.final = null;
    this.removed = [];
    return undefined;
  }

  endEarly(by: string): string | undefined {
    if (by !== this.hostId) return "Seul l'hôte peut arrêter la partie.";
    if (this.phase !== 'playing') return undefined;
    return this.restart(by);
  }

  private startRound(activeId: string): void {
    const active = this.get(activeId)!;
    this.round = {
      number: ++this.roundCount,
      phase: 'give',
      activeId,
      card: null,
      path: [activeId],
      seen: new Set([activeId]),
      claim: null,
      claimerId: null,
      actorId: null,
      turnEndsAt: 0,
      botActAt: 0,
      reveal: null,
      revealEndsAt: 0,
      revealMinAt: 0,
      ready: new Set(),
    };
    // Filet de sécurité : la révélation l'a déjà annoncé, mais une main vide au moment de lancer, c'est perdu.
    if (!active.hand.length) {
      this.finishGame(activeId, 'empty', null);
      return;
    }
    this.setActor(this.round, activeId);
  }

  private setActor(r: Round, id: string): void {
    const now = Date.now();
    r.actorId = id;
    r.turnEndsAt = FAST ? now + 900 : this.settings.think ? now + this.settings.think * 1000 : 0;
    r.botActAt = FAST ? now + 15 : this.onlyBotsLeft() ? now + 500 : now + 1400 + Math.random() * 2200;
  }

  /** Plus aucun humain en jeu : les bots finissent vite pour ne pas faire attendre les spectateurs. */
  private onlyBotsLeft(): boolean {
    return this.playing().every((p) => p.isBot || p.left);
  }

  /** Ceux à qui l'on peut encore glisser la carte : en jeu, et qui ne l'ont pas vue. */
  targetsFor(r: Round, id: string): string[] {
    if (r.actorId !== id) return [];
    if (r.phase === 'give') return this.playing().filter((p) => p.id !== id).map((p) => p.id);
    if (r.phase === 'peek') return this.playing().filter((p) => p.id !== id && !r.seen.has(p.id)).map((p) => p.id);
    return [];
  }

  canPeek(r: Round, id: string): boolean {
    if (r.phase !== 'answer' || r.actorId !== id) return false;
    // À deux, on ne repasse jamais une carte.
    if (this.playing().length <= 2) return false;
    return this.playing().some((p) => p.id !== id && !r.seen.has(p.id));
  }

  give(id: string, card: unknown, to: unknown, claim: unknown): string | undefined {
    const r = this.round;
    if (this.phase !== 'playing' || !r || r.phase !== 'give') return "Ce n'est pas le moment de donner une carte.";
    if (r.actorId !== id) return "Ce n'est pas ton tour.";
    const p = this.get(id)!;
    if (!isAnimal(card) || !p.hand.includes(card)) return "Tu n'as pas cette carte.";
    if (typeof to !== 'string' || !this.targetsFor(r, id).includes(to)) return 'Choisis un autre joueur.';
    if (!isAnimal(claim)) return 'Annonce une bestiole.';
    p.hand.splice(p.hand.indexOf(card), 1);
    r.card = card;
    r.claim = claim;
    r.claimerId = id;
    if (claim !== card) p.stats.lies++;
    r.path.push(to);
    r.phase = 'answer';
    if (p.isBot && !FAST && Math.random() < 0.1) this.onEmote(id, TAUNTS[crypto.randomInt(TAUNTS.length)]);
    this.setActor(r, to);
    return undefined;
  }

  peek(id: string): string | undefined {
    const r = this.round;
    if (this.phase !== 'playing' || !r || r.phase !== 'answer') return "Ce n'est pas le moment de regarder la carte.";
    if (r.actorId !== id) return "Ce n'est pas à toi de décider.";
    if (this.playing().length <= 2) return 'À deux, on ne repasse pas les cartes : réponds.';
    if (!this.canPeek(r, id)) return "Tout le monde l'a déjà vue : tu dois répondre.";
    r.seen.add(id);
    r.phase = 'peek';
    // Le chrono ne repart pas de zéro, mais il reste de quoi choisir à qui la refiler.
    const now = Date.now();
    if (r.turnEndsAt > 0) r.turnEndsAt = Math.max(r.turnEndsAt, now + (FAST ? 900 : (this.settings.think * 1000) / 2));
    r.botActAt = FAST ? now + 15 : now + 900 + Math.random() * 1600;
    return undefined;
  }

  pass(id: string, to: unknown, claim: unknown): string | undefined {
    const r = this.round;
    if (this.phase !== 'playing' || !r || r.phase !== 'peek') return "Ce n'est pas le moment de refiler la carte.";
    if (r.actorId !== id) return "Ce n'est pas à toi de jouer.";
    if (typeof to !== 'string' || !this.targetsFor(r, id).includes(to)) return 'Cette personne a déjà vu la carte.';
    if (!isAnimal(claim)) return 'Annonce une bestiole.';
    const p = this.get(id)!;
    p.stats.passes++;
    if (claim !== r.card) p.stats.lies++;
    r.claim = claim;
    r.claimerId = id;
    r.path.push(to);
    r.phase = 'answer';
    this.setActor(r, to);
    return undefined;
  }

  /** « C'est vrai » ou « c'est faux » : la carte se retourne. */
  answer(id: string, truth: unknown): string | undefined {
    const r = this.round;
    if (this.phase !== 'playing' || !r || r.phase !== 'answer') return "Ce n'est pas le moment de répondre.";
    if (r.actorId !== id) return "Ce n'est pas à toi de répondre.";
    if (typeof truth !== 'boolean') return 'Réponds « vrai » ou « faux ».';
    const card = r.card!;
    const claim = r.claim!;
    const claimerId = r.claimerId!;
    const isTrue = card === claim;
    const right = truth === isTrue;
    // Bien vu : celui qui l'a glissée la reprend. Raté : le receveur la garde.
    const taker = this.get(right ? claimerId : id)!;
    const receiver = this.get(id)!;
    const claimer = this.get(claimerId)!;
    if (right) receiver.stats.reads++;
    else {
      receiver.stats.misreads++;
      claimer.stats.fooled++;
    }
    taker.piles[card]++;
    let loserId: string | null = null;
    let endReason: EndReason | null = null;
    if (taker.piles[card] >= this.loseAt) {
      loserId = taker.id;
      endReason = 'collection';
    } else if (!taker.hand.length) {
      // Celui qui prend la carte lance le tour suivant : sans rien en main, il a perdu.
      loserId = taker.id;
      endReason = 'empty';
    }
    const now = Date.now();
    r.phase = 'reveal';
    r.actorId = null;
    r.turnEndsAt = 0;
    r.seen.add(id);
    r.reveal = { card, claim, claimerId, receiverId: id, said: truth, truth: isTrue, right, takerId: taker.id, loserId, endReason };
    r.revealMinAt = now + REVEAL_MIN_MS;
    const quick = this.onlyBotsLeft() ? 900 : loserId ? REVEAL_END_MS : REVEAL_MS;
    r.revealEndsAt = FAST ? now + REVEAL_MS : r.revealMinAt + quick;
    r.ready.clear();
    if (!FAST && taker.isBot === false && claimer.isBot && claimer.id !== taker.id && Math.random() < 0.18) this.onEmote(claimer.id, TAUNTS[4]);
    return undefined;
  }

  readyNext(id: string): string | undefined {
    const r = this.round;
    if (this.phase !== 'playing' || !r || r.phase !== 'reveal') return undefined;
    r.ready.add(id);
    const needed = this.players.filter((p) => !p.isBot && !this.isAuto(p) && p.connected && p.status === 'playing');
    if (needed.every((p) => r.ready.has(p.id))) {
      // Tout le monde a vu : on abrège l'attente, sans couper le retournement de la carte.
      if (Date.now() >= r.revealMinAt) this.afterRound();
      else r.revealEndsAt = r.revealMinAt;
    }
    return undefined;
  }

  afterRound(): void {
    const r = this.round;
    if (!r?.reveal || r.phase !== 'reveal') return;
    const rv = r.reveal;
    if (rv.loserId && rv.endReason) this.finishGame(rv.loserId, rv.endReason, rv.endReason === 'collection' ? rv.card : null);
    else this.startRound(rv.takerId);
  }

  private finishGame(loserId: string, reason: EndReason, animal: Animal | null): void {
    this.phase = 'finished';
    this.clearTimer();
    this.final = {
      loserId,
      reason,
      animal,
      entries: this.playing().map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        loser: p.id === loserId,
        piles: { ...p.piles },
        handCount: p.hand.length,
        stats: { ...p.stats },
      })),
    };
  }

  // ───────────────────────────── Minuteries & automatismes ─────────────────────────────

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** À appeler après chaque changement : planifie la prochaine échéance puis diffuse l'état. */
  commit(): void {
    this.reschedule();
    this.onChange();
  }

  private at(ms: number, fn: () => void): void {
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        fn();
      } catch (e) {
        console.error(`[room ${this.code}]`, e);
      }
      this.commit();
    }, Math.max(0, Math.min(ms, 2_147_000_000)));
  }

  /** Quand agir pour un joueur : bot → délai naturel, absent → fin du délai de grâce, sinon à la fin du chrono éventuel. */
  private dueAt(p: Player, deadline: number, botAt: number): number {
    const limit = deadline > 0 ? deadline : Infinity;
    if (this.isAuto(p)) return p.isBot ? botAt : Math.min(botAt, Date.now() + 700);
    if (!p.connected) return Math.min(limit, p.disconnectedAt + GRACE_MS);
    return limit;
  }

  private reschedule(): void {
    this.clearTimer();
    if (this.phase !== 'playing') return;
    const now = Date.now();
    const r = this.round;
    if (!r) return;
    if (r.phase === 'reveal') {
      this.at(r.revealEndsAt - now, () => {
        if (this.round === r && r.phase === 'reveal') this.afterRound();
      });
      return;
    }
    if (!r.actorId) return;
    const p = this.get(r.actorId);
    if (!p) return;
    const actorId = r.actorId;
    const phase = r.phase;
    const due = this.dueAt(p, r.turnEndsAt, r.botActAt);
    if (!Number.isFinite(due)) return;
    this.at(due - now, () => {
      if (this.round !== r || r.phase !== phase || r.actorId !== actorId) return;
      if (this.isAuto(p) || (r.turnEndsAt > 0 && Date.now() >= r.turnEndsAt) || !p.connected) this.autoPlay(r, p);
    });
  }

  /** Exactement ce qu'un joueur assis à cette place pourrait savoir. */
  botView(r: Round, p: Player): BotView {
    return {
      me: p.id,
      hand: [...p.hand],
      seats: this.playing().map((s) => ({ id: s.id, handCount: s.hand.length, piles: { ...s.piles } })),
      loseAt: this.loseAt,
      personality: p.personality,
      claim: r.phase === 'give' ? null : r.claim,
      claimerId: r.phase === 'give' ? null : r.claimerId,
      card: r.seen.has(p.id) && r.phase !== 'give' ? r.card : null,
      targets: this.targetsFor(r, p.id),
      canPeek: this.canPeek(r, p.id),
    };
  }

  private autoPlay(r: Round, p: Player): void {
    const move = botTurn(this.botView(r, p));
    let err: string | undefined;
    if (move.type === 'give') err = this.give(p.id, move.card, move.to, move.claim);
    else if (move.type === 'pass') err = this.pass(p.id, move.to, move.claim);
    else if (move.type === 'peek') {
      err = this.peek(p.id);
      // Un humain remplacé par le pilote : le pilote va au bout du coup au lieu de lui rendre la main à moitié.
      if (!err && !p.isBot) {
        const next = botTurn(this.botView(r, p));
        if (next.type === 'pass') err = this.pass(p.id, next.to, next.claim);
      }
    } else err = this.answer(p.id, move.truth);
    if (!err) return;
    // Filet de sécurité : la partie ne doit jamais se bloquer sur un bot.
    console.error(`[room ${this.code}] coup refusé (${move.type}) : ${err}`);
    if (r.phase === 'give') this.give(p.id, p.hand[0], this.targetsFor(r, p.id)[0], p.hand[0]);
    else if (r.phase === 'peek') this.pass(p.id, this.targetsFor(r, p.id)[0], r.card);
    else if (r.phase === 'answer') this.answer(p.id, Math.random() < 0.5);
  }

  dispose(): void {
    this.clearTimer();
  }

  // ───────────────────────────── Vue personnalisée ─────────────────────────────

  viewFor(viewerId: string): RoomView {
    const r = this.round;
    const viewer = this.get(viewerId);
    const inGame = this.phase !== 'lobby';
    return {
      code: this.code,
      phase: this.phase,
      me: viewerId,
      hostId: this.hostId,
      settings: { ...this.settings },
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isBot: p.isBot,
        isHost: p.id === this.hostId,
        connected: p.isBot || p.connected,
        autopilot: !p.isBot && p.status === 'playing' && this.isAuto(p),
        status: p.status,
        handCount: inGame ? p.hand.length : 0,
        piles: { ...p.piles },
      })),
      round:
        r && this.phase === 'playing'
          ? {
              number: r.number,
              phase: r.phase,
              activeId: r.activeId,
              actorId: r.actorId,
              turnEndsAt: r.turnEndsAt,
              path: [...r.path],
              seenIds: [...r.seen],
              claim: r.phase === 'give' ? null : r.claim,
              claimerId: r.phase === 'give' ? null : r.claimerId,
              // Le cœur du jeu : la bestiole ne sort que vers ceux qui l'ont regardée, jusqu'à ce qu'elle se retourne.
              card: r.phase === 'reveal' || (r.phase !== 'give' && r.seen.has(viewerId)) ? r.card : null,
              targets: this.targetsFor(r, viewerId),
              canPeek: this.canPeek(r, viewerId),
              reveal: r.reveal ? { ...r.reveal } : null,
              revealEndsAt: r.revealEndsAt,
              revealMinAt: r.revealMinAt,
              readyIds: [...r.ready],
            }
          : null,
      hand: viewer && viewer.status === 'playing' && inGame ? sortHand(viewer.hand) : null,
      removed: this.removed.length,
      loseAt: this.loseAt,
      final: this.final,
      serverNow: Date.now(),
    };
  }
}
