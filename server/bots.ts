// Cerveau des bots : ils ne connaissent que leur main, les cartes face visible, le nombre de cartes de chacun
// et le trajet en cours. Jamais la main d'un autre, jamais une carte qu'ils n'ont pas regardée, jamais les tours passés.
import { ANIMALS, COPIES, type Animal, type Piles } from '../shared/protocol';

export interface Personality {
  /** Goût de la vérité : annoncer la vraie bestiole (0 à 1). */
  candor: number;
  /** Goût du risque : regarder et refiler plutôt que répondre (0 à 1). */
  nerve: number;
  /** Méfiance : penchant pour « c'est faux » (0 à 1). */
  doubt: number;
  /** Acharnement : viser celui qui est le plus près de perdre (0 à 1). */
  spite: number;
}

export function randomPersonality(rng: () => number = Math.random): Personality {
  return { candor: 0.15 + rng() * 0.6, nerve: 0.15 + rng() * 0.7, doubt: 0.2 + rng() * 0.6, spite: 0.2 + rng() * 0.7 };
}

/** Le pilote automatique d'un humain absent : sans manie particulière. */
export const NEUTRAL: Personality = { candor: 0.45, nerve: 0.45, doubt: 0.5, spite: 0.5 };

export interface Seat {
  id: string;
  handCount: number;
  piles: Piles;
}

/** Tout ce qu'un bot sait. Ce qui est caché aux joueurs n'y figure pas : il ne peut pas tricher. */
export interface BotView {
  me: string;
  hand: Animal[];
  seats: Seat[];
  loseAt: number;
  personality: Personality;
  /** L'annonce en cours et son auteur (null quand c'est au bot de lancer une carte). */
  claim: Animal | null;
  claimerId: string | null;
  /** La carte, seulement si le bot l'a regardée. */
  card: Animal | null;
  /** À qui il peut donner ou refiler la carte. */
  targets: string[];
  canPeek: boolean;
}

export type BotMove =
  | { type: 'give'; card: Animal; to: string; claim: Animal }
  | { type: 'answer'; truth: boolean }
  | { type: 'peek' }
  | { type: 'pass'; to: string; claim: Animal };

/** Ce que coûte de prendre une bestiole : un peu au début, beaucoup près de la collection, tout si elle fait perdre. */
export function harm(count: number, handAfter: number, loseAt: number): number {
  // Celui qui prend la carte lance le tour suivant : sans carte en main, il a perdu.
  if (handAfter <= 0) return 100;
  const n = count + 1;
  if (n >= loseAt) return 100;
  return 1 + 7 * ((n - 1) / Math.max(1, loseAt - 2)) ** 2;
}

/** Combien d'exemplaires de chaque bestiole peuvent encore se cacher ailleurs, vu de ce bot. */
export function unknownCounts(view: BotView): Record<Animal, number> {
  const out = {} as Record<Animal, number>;
  for (const a of ANIMALS) {
    let n = COPIES - view.hand.filter((h) => h === a).length;
    for (const s of view.seats) n -= s.piles[a];
    out[a] = Math.max(0, n);
  }
  return out;
}

/** Ce que tout le monde peut estimer d'une annonce, d'après les seules cartes face visible. */
function plausible(seats: Seat[], claim: Animal): number {
  let shown = 0;
  let total = 0;
  for (const s of seats) {
    shown += s.piles[claim];
    for (const a of ANIMALS) total += s.piles[a];
  }
  const left = COPIES - shown;
  const avg = Math.max(1, (ANIMALS.length * COPIES - total) / ANIMALS.length);
  return Math.min(0.85, Math.max(0.12, 0.5 * Math.sqrt(left / avg)));
}

/** La chance, selon ce bot, que l'annonce reçue soit vraie. */
export function beliefTrue(view: BotView, rng: () => number = Math.random): number {
  const claim = view.claim!;
  const unknown = unknownCounts(view);
  const total = ANIMALS.reduce((n, a) => n + unknown[a], 0);
  if (unknown[claim] === 0 || total === 0) return 0;
  // Une bestiole rare d'après ce qu'on voit est une annonce suspecte ; une bestiole abondante, plausible.
  const ratio = (unknown[claim] / total) * ANIMALS.length;
  const honesty = Math.min(0.8, Math.max(0.2, 0.58 - view.personality.doubt * 0.22 + (rng() - 0.5) * 0.16));
  const yes = honesty * ratio;
  return yes / (yes + (1 - honesty));
}

function seat(view: BotView, id: string): Seat {
  return view.seats.find((s) => s.id === id) ?? { id, handCount: 0, piles: Object.fromEntries(ANIMALS.map((a) => [a, 0])) as Piles };
}

/** Répondre ou regarder : le bot pèse ce que lui coûterait chaque erreur. */
function receive(view: BotView, rng: () => number): BotMove {
  const claim = view.claim!;
  const mine = seat(view, view.me);
  const handAfter = view.hand.length;
  const p = beliefTrue(view, rng);
  const unknown = unknownCounts(view);
  const others = ANIMALS.filter((a) => a !== claim);
  const otherTotal = others.reduce((n, a) => n + unknown[a], 0);
  const ifFalse = otherTotal ? others.reduce((n, a) => n + (unknown[a] / otherTotal) * harm(mine.piles[a], handAfter, view.loseAt), 0) : 1;
  const ifTrue = harm(mine.piles[claim], handAfter, view.loseAt);
  const noise = () => 0.8 + rng() * 0.4;
  const sayTrue = (1 - p) * ifFalse * noise();
  const sayFalse = p * ifTrue * noise();
  const answer = Math.min(sayTrue, sayFalse);
  if (view.canPeek) {
    // Refiler, c'est parier qu'on bluffera mieux que celui d'avant, et le suivant peut encore la refiler à son tour.
    const caught = 0.45 - view.personality.nerve * 0.15;
    const peek = caught * (p * ifTrue + (1 - p) * ifFalse) * noise();
    // Nettement plus sûr : on regarde. À peu près pareil : question de tempérament.
    if (peek < answer * 0.7) return { type: 'peek' };
    if (peek < answer * 1.6 && rng() < 0.25 + view.personality.nerve * 0.5) return { type: 'peek' };
  }
  return { type: 'answer', truth: sayTrue < sayFalse };
}

function pick<T>(items: T[], weight: (x: T) => number, rng: () => number): T {
  const total = items.reduce((n, x) => n + weight(x), 0);
  let roll = rng() * total;
  for (const x of items) {
    roll -= weight(x);
    if (roll <= 0) return x;
  }
  return items[items.length - 1];
}

/** Lancer ou refiler une carte : à qui, et avec quelle annonce. */
function send(view: BotView, cards: Animal[], handAfter: (card: Animal) => number, rng: () => number): { card: Animal; to: string; claim: Animal } {
  const me = view.personality;
  const mine = seat(view, view.me);
  // D'abord la carte et la victime : ce qui ferait mal à l'autre, sans trop risquer de la reprendre soi-même.
  let card = cards[0];
  let to = view.targets[0];
  let bestScore = -Infinity;
  for (const c of [...new Set(cards)]) {
    const back = harm(mine.piles[c], handAfter(c), view.loseAt);
    for (const t of view.targets) {
      const them = seat(view, t);
      const hurt = harm(them.piles[c], them.handCount, view.loseAt) * (0.6 + me.spite * 0.8);
      // Un peu d'imprévu : un bluffeur prévisible ne trompe personne.
      const score = 0.5 * hurt - 0.55 * back + (rng() - 0.5) * 2.2;
      if (score > bestScore) {
        bestScore = score;
        card = c;
        to = t;
      }
    }
  }
  // Puis l'annonce. Une bestiole rare d'après la table paraît suspecte : la dire vraie, c'est piéger celui qui doute.
  const rare = 1 - plausible(view.seats, card);
  const truth = rng() < Math.min(0.8, Math.max(0.12, 0.1 + me.candor * 0.75 + (rare - 0.5) * 0.4));
  if (truth) return { card, to, claim: card };
  // Un mensonge crédible : une bestiole abondante, ou celle qui fait peur au receveur, pour qu'il réponde « vrai » par prudence.
  const them = seat(view, to);
  const lies = ANIMALS.filter((a) => a !== card);
  const claim = pick(lies, (a) => plausible(view.seats, a) * (1 + 0.9 * them.piles[a]) + 0.05, rng);
  return { card, to, claim };
}

export function botTurn(view: BotView, rng: () => number = Math.random): BotMove {
  if (view.claim === null) {
    const left = view.hand.length - 1;
    return { type: 'give', ...send(view, view.hand, () => left, rng) };
  }
  if (view.card) {
    const card = view.card;
    const { to, claim } = send(view, [card], () => view.hand.length, rng);
    return { type: 'pass', to, claim };
  }
  return receive(view, rng);
}
