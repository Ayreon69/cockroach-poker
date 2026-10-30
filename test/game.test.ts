// La donne, la passe, la révélation, la fin de partie, les bots et les secrets de la vue envoyée à chaque joueur.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANIMALS, COPIES, DECK_SIZE, MAX_PLAYERS, emptyPiles, loseAt, type Animal } from '../shared/protocol';
import { NEUTRAL, beliefTrue, botTurn, harm, randomPersonality, type BotView } from '../server/bots';
import { Room, type Player } from '../server/room';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Une bestiole écrite comme valeur (entre guillemets) : un identifiant pourrait contenir « rat » par hasard. */
const QUOTED_ANIMAL = new RegExp(`"(${ANIMALS.join('|')})"`);

/** Une table lancée : n humains (le premier est l'hôte) et des bots. */
function table(humans: number, bots = 0): { room: Room; players: Player[] } {
  const room = new Room('TEST');
  const players = Array.from({ length: humans }, (_, i) => {
    const p = room.addHuman(`Joueur ${i}`, 'hibou');
    if (typeof p === 'string') throw new Error(p);
    p.connected = true;
    return p;
  });
  room.hostId = players[0].id;
  for (let i = 0; i < bots; i++) room.addBot(players[0].id);
  expect(room.start(players[0].id)).toBeUndefined();
  return { room, players };
}

/** Le joueur dont on attend la décision. */
function actor(room: Room): Player {
  return room.get(room.round!.actorId!)!;
}

/** Impose la carte que l'actif va donner et la lui met en main. */
function giveCard(room: Room, card: Animal, toId: string, claim: Animal): void {
  const a = actor(room);
  if (!a.hand.includes(card)) a.hand[0] = card;
  expect(room.give(a.id, card, toId, claim)).toBeUndefined();
}

function other(room: Room, notIds: string[]): Player {
  return room.playing().find((p) => !notIds.includes(p.id))!;
}

/** Fait tourner la table jusqu'au bout, sans intervenir. */
function runOut(room: Room, maxSteps = 4000): void {
  room.commit();
  for (let i = 0; i < maxSteps && room.phase === 'playing'; i++) vi.advanceTimersByTime(4000);
}

function totalCards(room: Room): number {
  let n = room.removed.length;
  for (const p of room.playing()) n += p.hand.length + ANIMALS.reduce((s, a) => s + p.piles[a], 0);
  if (room.round && room.round.card && room.round.phase !== 'reveal') n++;
  return n;
}

describe('mise en place', () => {
  it('on joue de 2 à 6, pas tout seul et pas à 7', () => {
    const solo = new Room('TEST');
    const host = solo.addHuman('Hôte', 'hibou') as Player;
    expect(solo.start(host.id)).toMatch(/au moins 2/);
    for (let i = 0; i < MAX_PLAYERS - 1; i++) expect(solo.addBot(host.id)).toBeUndefined();
    expect(solo.addBot(host.id)).toMatch(/complète/);
    expect(solo.addHuman('Tard', 'crabe')).toMatch(/complète/);
  });

  it('le paquet compte 64 cartes : huit bestioles en huit exemplaires', () => {
    expect(DECK_SIZE).toBe(64);
    expect(ANIMALS).toHaveLength(8);
    expect(COPIES).toBe(8);
  });

  it.each([
    [3, [22, 21, 21]],
    [4, [16, 16, 16, 16]],
    [5, [13, 13, 13, 13, 12]],
    [6, [11, 11, 11, 11, 10, 10]],
  ])('à %i, toutes les cartes sont distribuées, à une carte près', (n, sizes) => {
    const { room } = table(1, n - 1);
    const counts = room.playing().map((p) => p.hand.length);
    expect([...counts].sort((a, b) => b - a)).toEqual(sizes);
    expect(room.removed).toHaveLength(0);
    // La donne part du premier joueur : il a forcément une des plus grosses mains.
    expect(room.get(room.round!.activeId)!.hand.length).toBe(sizes[0]);
    const all = room.playing().flatMap((p) => p.hand);
    for (const a of ANIMALS) expect(all.filter((c) => c === a)).toHaveLength(8);
    expect(room.loseAt).toBe(4);
  });

  it('à deux : dix cartes écartées, 27 chacun, et on perd à cinq', () => {
    const { room } = table(2);
    expect(room.removed).toHaveLength(10);
    expect(room.playing().map((p) => p.hand.length)).toEqual([27, 27]);
    expect(room.loseAt).toBe(5);
    expect(loseAt(2)).toBe(5);
    expect(loseAt(3)).toBe(4);
  });

  it('la partie commence par une carte à donner, et seul l’hôte la lance', () => {
    const room = new Room('TEST');
    const host = room.addHuman('Hôte', 'hibou') as Player;
    const guest = room.addHuman('Invité', 'crabe') as Player;
    expect(room.start(guest.id)).toMatch(/hôte/);
    expect(room.start(host.id)).toBeUndefined();
    expect(room.round!.phase).toBe('give');
    expect(room.round!.actorId).toBe(room.round!.activeId);
  });
});

describe('donner une carte', () => {
  it('refuse une carte absente, soi-même comme cible, une annonce inconnue ou hors de son tour', () => {
    const { room } = table(3);
    const a = actor(room);
    const b = other(room, [a.id]);
    const missing = ANIMALS.find((x) => !a.hand.includes(x));
    if (missing) expect(room.give(a.id, missing, b.id, 'rat')).toMatch(/pas cette carte/);
    expect(room.give(a.id, a.hand[0], a.id, 'rat')).toMatch(/autre joueur/);
    expect(room.give(a.id, a.hand[0], b.id, 'licorne')).toMatch(/bestiole/);
    expect(room.give(b.id, b.hand[0], a.id, 'rat')).toMatch(/pas ton tour/);
    const before = a.hand.length;
    expect(room.give(a.id, a.hand[0], b.id, 'rat')).toBeUndefined();
    expect(a.hand).toHaveLength(before - 1);
    expect(room.round!.phase).toBe('answer');
    expect(room.round!.actorId).toBe(b.id);
  });
});

describe('répondre', () => {
  // [carte, annonce, réponse « c'est vrai ? », qui prend : le receveur ou celui qui a glissé la carte]
  it.each([
    ['rat', 'rat', true, 'claimer'],
    ['rat', 'rat', false, 'receiver'],
    ['rat', 'crapaud', false, 'claimer'],
    ['rat', 'crapaud', true, 'receiver'],
  ] as const)('%s annoncé %s, réponse vrai=%s : %s prend la carte', (card, claim, said, who) => {
    const { room } = table(3);
    const a = actor(room);
    const b = other(room, [a.id]);
    giveCard(room, card, b.id, claim);
    expect(room.answer(b.id, said)).toBeUndefined();
    const rv = room.round!.reveal!;
    const taker = who === 'claimer' ? a : b;
    expect(rv.takerId).toBe(taker.id);
    expect(rv.right).toBe(who === 'claimer');
    expect(taker.piles[card]).toBe(1);
    // Celui qui prend la carte lance le tour suivant.
    room.afterRound();
    expect(room.round!.activeId).toBe(taker.id);
    expect(room.round!.phase).toBe('give');
  });

  it('refuse une réponse qui n’est ni vrai ni faux', () => {
    const { room } = table(3);
    const a = actor(room);
    const b = other(room, [a.id]);
    giveCard(room, 'mouche', b.id, 'mouche');
    expect(room.answer(b.id, 'oui')).toBeTruthy();
    expect(room.answer(a.id, true)).toBeTruthy();
  });
});

describe('regarder et refiler', () => {
  it('on refile à quelqu’un qui ne l’a pas vue, jamais en arrière, et le dernier doit répondre', () => {
    const { room } = table(4);
    const [a] = [actor(room)];
    const b = other(room, [a.id]);
    const c = other(room, [a.id, b.id]);
    const d = other(room, [a.id, b.id, c.id]);
    giveCard(room, 'scorpion', b.id, 'araignee');
    expect(room.pass(b.id, c.id, 'rat')).toMatch(/moment/);
    expect(room.peek(b.id)).toBeUndefined();
    expect(room.answer(b.id, true)).toMatch(/moment/);
    expect(room.pass(b.id, a.id, 'rat')).toMatch(/déjà vu/);
    expect(room.pass(b.id, c.id, 'rat')).toBeUndefined();
    expect(room.round!.claim).toBe('rat');
    expect(room.round!.claimerId).toBe(b.id);
    expect(room.peek(c.id)).toBeUndefined();
    expect(room.pass(c.id, b.id, 'rat')).toMatch(/déjà vu/);
    expect(room.pass(c.id, d.id, 'scorpion')).toBeUndefined();
    // Tout le monde l'a vue sauf d : il n'a plus le choix.
    expect(room.canPeek(room.round!, d.id)).toBe(false);
    expect(room.peek(d.id)).toMatch(/répondre/);
    // c a dit la vérité, d répond « faux » : raté, d garde le scorpion.
    expect(room.answer(d.id, false)).toBeUndefined();
    expect(room.round!.reveal!.takerId).toBe(d.id);
    expect(d.piles.scorpion).toBe(1);
  });

  it('à deux, on ne repasse jamais une carte', () => {
    const { room } = table(2);
    const a = actor(room);
    const b = other(room, [a.id]);
    giveCard(room, 'rat', b.id, 'rat');
    expect(room.canPeek(room.round!, b.id)).toBe(false);
    expect(room.peek(b.id)).toMatch(/deux/);
  });
});

describe('fin de partie', () => {
  it('quatre bestioles identiques devant soi : perdu, et tous les autres gagnent', () => {
    const { room } = table(3);
    const a = actor(room);
    const b = other(room, [a.id]);
    b.piles.crapaud = 3;
    giveCard(room, 'crapaud', b.id, 'crapaud');
    room.answer(b.id, false);
    expect(room.round!.reveal!.loserId).toBe(b.id);
    expect(room.round!.reveal!.endReason).toBe('collection');
    room.afterRound();
    expect(room.phase).toBe('finished');
    expect(room.final!.loserId).toBe(b.id);
    expect(room.final!.animal).toBe('crapaud');
    expect(room.final!.entries.filter((e) => e.loser)).toHaveLength(1);
  });

  it('à deux, il en faut cinq', () => {
    const { room } = table(2);
    const a = actor(room);
    const b = other(room, [a.id]);
    b.piles.crapaud = 3;
    giveCard(room, 'crapaud', b.id, 'crapaud');
    room.answer(b.id, false);
    expect(room.round!.reveal!.loserId).toBeNull();
  });

  it('qui doit lancer une carte sans rien en main a perdu', () => {
    const { room } = table(3);
    const a = actor(room);
    const b = other(room, [a.id]);
    b.hand = [];
    giveCard(room, 'rat', b.id, 'rat');
    room.answer(b.id, false);
    expect(room.round!.reveal!.takerId).toBe(b.id);
    expect(room.round!.reveal!.endReason).toBe('empty');
    room.afterRound();
    expect(room.final!.reason).toBe('empty');
    expect(room.final!.loserId).toBe(b.id);
  });

  it('la revanche ramène au salon', () => {
    const { room, players } = table(1, 2);
    players[0].left = true;
    runOut(room);
    expect(room.phase).toBe('finished');
    // L'hôte parti est remplacé par le premier humain revenu.
    room.connect(players[0], 'sock');
    expect(room.restart(players[0].id)).toBeUndefined();
    expect(room.phase).toBe('lobby');
    expect(room.start(players[0].id)).toBeUndefined();
  });
});

describe('secrets', () => {
  it('la carte ne sort que vers ceux qui l’ont vue, puis vers tous quand elle se retourne', () => {
    const { room } = table(4);
    const a = actor(room);
    const b = other(room, [a.id]);
    const c = other(room, [a.id, b.id]);
    const d = other(room, [a.id, b.id, c.id]);
    giveCard(room, 'punaise', b.id, 'mouche');
    expect(room.viewFor(a.id).round!.card).toBe('punaise');
    for (const p of [b, c, d]) expect(room.viewFor(p.id).round!.card).toBeNull();
    room.peek(b.id);
    expect(room.viewFor(b.id).round!.card).toBe('punaise');
    expect(room.viewFor(c.id).round!.card).toBeNull();
    room.pass(b.id, c.id, 'rat');
    for (const p of [c, d]) {
      const v = room.viewFor(p.id);
      expect(v.round!.card).toBeNull();
      // Dans tout le tour, la seule bestiole qui circule est l'annonce en cours.
      expect(JSON.stringify({ ...v.round, claim: null })).not.toMatch(QUOTED_ANIMAL);
    }
    room.answer(c.id, true);
    for (const p of [a, b, c, d]) expect(room.viewFor(p.id).round!.card).toBe('punaise');
  });

  it('ni la main des autres, ni les cartes écartées, ni le passé ne quittent le serveur', () => {
    const { room, players } = table(2);
    const [x, y] = players;
    const vx = room.viewFor(x.id);
    expect(vx.hand).toHaveLength(27);
    expect(vx.removed).toBe(10);
    const pub = JSON.stringify(vx.players);
    expect(pub).not.toContain('hand"');
    expect(pub).not.toContain('token');
    // Rien qui ressemble à un journal ou à un historique.
    for (const key of ['log', 'history', 'heard', 'claims']) expect(vx).not.toHaveProperty(key);
    const a = actor(room);
    const b = a.id === x.id ? y : x;
    giveCard(room, 'rat', b.id, 'cafard');
    room.answer(b.id, true);
    room.afterRound();
    const after = room.viewFor(x.id).round!;
    // Le tour suivant ne garde aucune trace du précédent : ni carte, ni annonce, ni trajet.
    expect(after.reveal).toBeNull();
    expect(after.claim).toBeNull();
    expect(after.card).toBeNull();
    expect(after.path).toEqual([after.activeId]);
  });

  it('seule l’annonce en cours circule, pas celles du trajet', () => {
    const { room } = table(4);
    const a = actor(room);
    const b = other(room, [a.id]);
    const c = other(room, [a.id, b.id]);
    giveCard(room, 'rat', b.id, 'chauvesouris');
    room.peek(b.id);
    room.pass(b.id, c.id, 'scorpion');
    const v = room.viewFor(c.id);
    expect(v.round!.claim).toBe('scorpion');
    expect(JSON.stringify({ ...v.round, claim: null })).not.toMatch(QUOTED_ANIMAL);
  });

  it('un spectateur n’a ni main ni carte', () => {
    const { room } = table(3);
    const spy = room.addHuman('Curieux', 'crabe');
    if (typeof spy === 'string') throw new Error(spy);
    expect(spy.status).toBe('spectator');
    const a = actor(room);
    giveCard(room, 'rat', other(room, [a.id]).id, 'rat');
    const v = room.viewFor(spy.id);
    expect(v.hand).toBeNull();
    expect(v.round!.card).toBeNull();
    expect(v.round!.targets).toEqual([]);
  });

  it('un bot ne sait de la carte que ce qu’il a vu', () => {
    const { room } = table(1, 3);
    const r = room.round!;
    const a = actor(room);
    const b = other(room, [a.id]);
    giveCard(room, 'mouche', b.id, 'rat');
    expect(room.botView(r, b).card).toBeNull();
    expect(room.botView(r, a).card).toBe('mouche');
    const bv = room.botView(r, b);
    expect(bv.hand).toEqual(b.hand);
    // Aucune main adverse dans ce qu'il reçoit : seulement des nombres de cartes.
    for (const s of bv.seats) expect(s).not.toHaveProperty('hand');
  });
});

describe('bots', () => {
  const seats = (ids: string[]) => ids.map((id) => ({ id, handCount: 10, piles: emptyPiles() }));

  it('le coût de prendre une carte grimpe vers la collection, et devient total quand elle fait perdre', () => {
    expect(harm(0, 5, 4)).toBeLessThan(harm(1, 5, 4));
    expect(harm(1, 5, 4)).toBeLessThan(harm(2, 5, 4));
    expect(harm(3, 5, 4)).toBe(100);
    expect(harm(0, 0, 4)).toBe(100);
  });

  it('ne croit pas une annonce impossible', () => {
    const view: BotView = {
      me: 'b',
      hand: ['rat', 'rat', 'rat', 'rat', 'rat'],
      seats: seats(['a', 'b', 'c']),
      loseAt: 4,
      personality: NEUTRAL,
      claim: 'rat',
      claimerId: 'a',
      card: null,
      targets: [],
      canPeek: false,
    };
    view.seats[2].piles.rat = 3;
    expect(beliefTrue(view)).toBe(0);
    for (let i = 0; i < 30; i++) expect(botTurn(view)).toEqual({ type: 'answer', truth: false });
  });

  it('ne dit jamais « faux » à une bestiole qui l’achèverait : « vrai » ne lui coûte presque rien', () => {
    for (let i = 0; i < 200; i++) {
      const view: BotView = {
        me: 'b',
        hand: ['mouche', 'rat'],
        seats: seats(['a', 'b', 'c', 'd']),
        loseAt: 4,
        personality: randomPersonality(),
        claim: 'crapaud',
        claimerId: 'a',
        card: null,
        targets: [],
        canPeek: i % 2 === 0,
      };
      view.seats[1].piles.crapaud = 3;
      expect(botTurn(view)).not.toEqual({ type: 'answer', truth: false });
    }
  });

  it('regarde et refile souvent quand rien n’est joué, mais pas toujours', () => {
    let peeks = 0;
    const n = 600;
    for (let i = 0; i < n; i++) {
      const move = botTurn({ me: 'b', hand: ['mouche', 'rat', 'cafard'], seats: seats(['a', 'b', 'c', 'd']), loseAt: 4, personality: randomPersonality(), claim: 'punaise', claimerId: 'a', card: null, targets: [], canPeek: true });
      if (move.type === 'peek') peeks++;
    }
    expect(peeks / n).toBeGreaterThan(0.2);
    expect(peeks / n).toBeLessThan(0.8);
  });

  it('refile à quelqu’un qui ne l’a pas vue, avec une annonce de son choix', () => {
    for (let i = 0; i < 100; i++) {
      const move = botTurn({ me: 'b', hand: ['mouche'], seats: seats(['a', 'b', 'c', 'd']), loseAt: 4, personality: randomPersonality(), claim: 'punaise', claimerId: 'a', card: 'rat', targets: ['c', 'd'], canPeek: false });
      expect(move.type).toBe('pass');
      if (move.type === 'pass') expect(['c', 'd']).toContain(move.to);
    }
  });

  it('bluffe de façon variée : ni toujours vrai, ni toujours faux, et pas toujours la même bestiole', () => {
    let truths = 0;
    const claims = new Set<Animal>();
    const targets = new Set<string>();
    const n = 600;
    for (let i = 0; i < n; i++) {
      const hand: Animal[] = Array.from({ length: 8 }, () => ANIMALS[Math.floor(Math.random() * 8)]);
      const view: BotView = { me: 'a', hand, seats: seats(['a', 'b', 'c', 'd']), loseAt: 4, personality: randomPersonality(), claim: null, claimerId: null, card: null, targets: ['b', 'c', 'd'], canPeek: false };
      const move = botTurn(view);
      if (move.type !== 'give') throw new Error('le bot doit donner');
      expect(hand).toContain(move.card);
      expect(move.to).not.toBe('a');
      if (move.claim === move.card) truths++;
      claims.add(move.claim);
      targets.add(move.to);
    }
    expect(truths / n).toBeGreaterThan(0.2);
    expect(truths / n).toBeLessThan(0.7);
    expect(claims.size).toBe(8);
    expect(targets.size).toBe(3);
  });

  it('vise celui qui n’a plus de carte en main', () => {
    let hits = 0;
    for (let i = 0; i < 200; i++) {
      const s = seats(['a', 'b', 'c', 'd']);
      s[2].handCount = 0;
      const move = botTurn({ me: 'a', hand: ['rat', 'mouche', 'cafard'], seats: s, loseAt: 4, personality: randomPersonality(), claim: null, claimerId: null, card: null, targets: ['b', 'c', 'd'], canPeek: false });
      if (move.type === 'give' && move.to === 'c') hits++;
    }
    expect(hits).toBeGreaterThan(160);
  });

  it.each([2, 3, 4, 5, 6])('à %i, les bots finissent toujours la partie, sans coup refusé ni carte perdue', (n) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (let g = 0; g < 25; g++) {
      const { room, players } = table(1, n - 1);
      players[0].left = true;
      runOut(room);
      expect(room.phase).toBe('finished');
      const f = room.final!;
      const loser = room.get(f.loserId)!;
      expect(f.entries.filter((e) => e.loser)).toHaveLength(1);
      if (f.reason === 'collection') expect(loser.piles[f.animal!]).toBe(loseAt(n));
      else expect(loser.hand).toHaveLength(0);
      expect(totalCards(room)).toBe(64);
      for (const p of room.playing()) for (const a of ANIMALS) expect(p.piles[a]).toBeLessThanOrEqual(loseAt(n));
    }
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('perdent moins souvent que des joueurs qui jouent au hasard', () => {
    let randomLosses = 0;
    const games = 300;
    for (let g = 0; g < games; g++) {
      const { room, players } = table(2, 2);
      const randoms = new Set(players.map((p) => p.id));
      room.commit();
      for (let i = 0; i < 3000 && room.phase === 'playing'; i++) {
        const r = room.round!;
        const p = r.actorId ? room.get(r.actorId)! : null;
        if (p && randoms.has(p.id)) {
          if (r.phase === 'give') {
            const targets = room.targetsFor(r, p.id);
            room.give(p.id, p.hand[Math.floor(Math.random() * p.hand.length)], targets[Math.floor(Math.random() * targets.length)], ANIMALS[Math.floor(Math.random() * 8)]);
          } else if (r.phase === 'answer') room.answer(p.id, Math.random() < 0.5);
          room.commit();
          continue;
        }
        vi.advanceTimersByTime(4000);
      }
      expect(room.phase).toBe('finished');
      if (randoms.has(room.final!.loserId)) randomLosses++;
    }
    // Moitié des places, mais nettement plus de la moitié des défaites.
    expect(randomLosses / games).toBeGreaterThan(0.6);
  });
});

describe('table', () => {
  it('un joueur parti est remplacé par le pilote et ne bloque pas la table', () => {
    const { room, players } = table(3);
    room.leave(players[1].id);
    expect(room.hostId).toBe(players[0].id);
    players[0].left = true;
    players[2].left = true;
    runOut(room);
    expect(room.phase).toBe('finished');
  });

  it('un joueur présent qui laisse filer le temps est remplacé par le pilote', () => {
    const { room } = table(3);
    room.settings.think = 30;
    const a = actor(room);
    const r = room.round!;
    r.turnEndsAt = Date.now() + 30_000;
    room.commit();
    vi.advanceTimersByTime(29_000);
    expect(room.round!.phase).toBe('give');
    vi.advanceTimersByTime(2_000);
    expect(room.round!.phase).toBe('answer');
    expect(room.round!.claimerId).toBe(a.id);
  });

  it('sans limite de temps, un joueur présent n’est jamais bousculé', () => {
    const { room } = table(3);
    room.commit();
    vi.advanceTimersByTime(10 * 60_000);
    expect(room.round!.phase).toBe('give');
  });

  it('un déconnecté a vingt secondes pour revenir avant le pilote', () => {
    const { room } = table(3);
    const a = actor(room);
    room.disconnect(a.id, 'x');
    a.connected = false;
    a.disconnectedAt = Date.now();
    room.commit();
    vi.advanceTimersByTime(15_000);
    expect(room.round!.phase).toBe('give');
    vi.advanceTimersByTime(8_000);
    expect(room.round!.phase).toBe('answer');
  });

  it('la révélation s’abrège quand tout le monde est prêt, sans couper le retournement', () => {
    const { room, players } = table(3);
    const a = actor(room);
    const b = other(room, [a.id]);
    giveCard(room, 'rat', b.id, 'rat');
    room.answer(b.id, true);
    for (const p of players) room.readyNext(p.id);
    expect(room.round!.phase).toBe('reveal');
    room.commit();
    vi.advanceTimersByTime(2_700);
    expect(room.round!.phase).toBe('give');
  });
});
