// Test de bout en bout : 3 humains (socket.io) + 2 bots jouent une partie complète sur le serveur compilé,
// pendant qu'un spectateur regarde. Chaque état reçu est audité : aucune carte cachée ne doit fuiter.
// Usage : npm run build && npm run e2e
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

const ANIMALS = ['cafard', 'chauvesouris', 'mouche', 'crapaud', 'rat', 'scorpion', 'araignee', 'punaise'];
// Entre guillemets : un identifiant de joueur pourrait contenir « rat » par hasard.
const ANIMAL_RE = new RegExp(`"(${ANIMALS.join('|')})"`);
const PORT = 3900 + Math.floor(Math.random() * 90);
const URL = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ['dist/server/index.mjs'], {
  env: { ...process.env, PORT: String(PORT), CR_FAST: '1' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  server.kill();
  process.exit(1);
};
setTimeout(() => fail('délai dépassé (3 min)'), 180_000).unref();

await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes('prêt') && resolve()));

let audited = 0;
let reveals = 0;
let passes = 0;
let maxRound = 0;

function client(name) {
  const socket = io(URL, { transports: ['websocket'], forceNew: true });
  const c = { name, socket, view: null, session: null, watcher: false };
  socket.on('state', (v) => {
    c.view = v;
    audit(v, c);
    if (!c.watcher) play(c);
  });
  c.call = (event, payload = {}) => new Promise((res) => socket.emit(event, payload, res));
  return c;
}

/** Vérifie les secrets sur chaque état reçu. */
function audit(v, c) {
  for (const key of ['log', 'history', 'heard', 'claims']) if (key in v) fail(`un historique circule (${key})`);
  const pub = JSON.stringify(v.players);
  if (pub.includes('"hand"') || pub.includes('token')) fail('une main ou un jeton apparaît dans la vue publique');
  const r = v.round;
  if (v.phase !== 'playing' || !r) return;
  audited++;
  maxRound = Math.max(maxRound, r.number);
  const me = v.players.find((p) => p.id === v.me);
  const seen = r.seenIds.includes(v.me);
  if (r.phase !== 'reveal' && r.card && !seen) fail(`${c.name} connaît une carte qu'il n'a pas vue`);
  if (r.phase !== 'reveal' && r.reveal) fail('révélation envoyée avant que la carte se retourne');
  // Dans le tour en cours, la seule bestiole qu'on peut lire est l'annonce (et la carte, si on l'a vue).
  const rest = JSON.stringify({ ...r, claim: null, card: null, reveal: null });
  if (ANIMAL_RE.test(rest)) fail('une bestiole circule hors de l’annonce en cours');
  if (me?.status === 'spectator' && (v.hand || r.card && r.phase !== 'reveal')) fail('un spectateur voit des cartes');
  if (me?.status === 'playing' && v.hand && v.hand.length !== me.handCount) fail(`${c.name} : main de ${v.hand.length} pour ${me.handCount}`);
  if (r.path.length > 2) passes++;
  // Aucune carte ne se perd ni ne se crée.
  let total = v.removed;
  for (const p of v.players) if (p.status === 'playing') total += p.handCount + ANIMALS.reduce((n, a) => n + p.piles[a], 0);
  if (r.phase === 'answer' || r.phase === 'peek') total++;
  if (total !== 64) fail(`il y a ${total} cartes sur la table`);
  if (r.reveal) {
    reveals++;
    const { card, claim, said, truth, right, takerId, claimerId, receiverId } = r.reveal;
    if (truth !== (card === claim)) fail('vérité mal établie');
    if (right !== (said === truth)) fail('verdict faux');
    if (takerId !== (right ? claimerId : receiverId)) fail('la carte va au mauvais joueur');
  }
}

/** Stratégie pour finir vite : au hasard, en regardant parfois la carte pour la refiler. */
function play(c) {
  const v = c.view;
  if (!v || v.phase !== 'playing' || !v.round) return;
  const r = v.round;
  const ack = () => {};
  const any = (list) => list[Math.floor(Math.random() * list.length)];
  if (r.phase === 'reveal') {
    if (!r.readyIds.includes(v.me)) c.socket.emit('game:next', {}, ack);
    return;
  }
  if (r.actorId !== v.me) return;
  if (r.phase === 'give' && v.hand?.length) c.socket.emit('game:give', { card: any(v.hand), to: any(r.targets), claim: any(ANIMALS) }, ack);
  else if (r.phase === 'answer') {
    if (r.canPeek && Math.random() < 0.4) c.socket.emit('game:peek', {}, ack);
    else c.socket.emit('game:answer', { truth: Math.random() < 0.5 }, ack);
  } else if (r.phase === 'peek') c.socket.emit('game:pass', { to: any(r.targets), claim: any(ANIMALS) }, ack);
}

const a = client('Alice');
const b = client('Bob');
const d = client('Chloé');
await Promise.all([a, b, d].map((c) => new Promise((r) => (c.socket.connected ? r() : c.socket.on('connect', r)))));

const created = await a.call('room:create', { name: 'Alice', avatar: 'hibou' });
if (!created.ok) fail(`création : ${created.error}`);
const code = created.data.code;
const joined = await b.call('room:join', { code: code.toLowerCase(), name: 'Bob', avatar: 'crabe' });
if (!joined.ok) fail(`jointure : ${joined.error}`);
b.session = joined.data;
const third = await d.call('room:join', { code, name: 'Chloé', avatar: 'tortue' });
if (!third.ok) fail(`jointure : ${third.error}`);
for (let i = 0; i < 2; i++) await a.call('room:addBot');
const denied = await b.call('game:start');
if (denied.ok) fail('un invité ne devrait pas pouvoir lancer la partie');
const started = await a.call('game:start');
if (!started.ok) fail(`lancement : ${started.error}`);
console.log(`✓ table ${code} lancée à 5 joueurs`);

// Un curieux arrive en cours de partie : il regarde, sans main ni carte.
const spy = client('Curieux');
spy.watcher = true;
await new Promise((r) => (spy.socket.connected ? r() : spy.socket.on('connect', r)));
const watching = await spy.call('room:join', { code, name: 'Curieux', avatar: 'hibou' });
if (!watching.ok) fail(`spectateur : ${watching.error}`);

// Bob se déconnecte puis revient avec son jeton : il doit retrouver sa place et sa main.
await new Promise((r) => setTimeout(r, 60));
b.socket.disconnect();
await new Promise((r) => setTimeout(r, 60));
const b2 = client('Bob');
await new Promise((r) => (b2.socket.connected ? r() : b2.socket.on('connect', r)));
const resumed = await b2.call('room:join', { code, ...b.session, resumeOnly: true });
if (!resumed.ok || resumed.data.playerId !== b.session.playerId) fail('reprise de session échouée');
console.log('✓ reconnexion de Bob sur sa place');

await new Promise((resolve) => {
  const check = setInterval(() => {
    if (a.view?.phase === 'finished') {
      clearInterval(check);
      resolve();
    }
  }, 50);
});
if (!audited || !reveals) fail("aucun état n'a été contrôlé");
console.log(`✓ aucune carte cachée dans les ${audited} états reçus (${maxRound} tours, ${reveals} révélations, des passes : ${passes ? 'oui' : 'non'})`);
const final = a.view.final;
if (final.entries.length !== 5) fail('il doit y avoir 5 joueurs à la fin');
const losers = final.entries.filter((e) => e.loser);
if (losers.length !== 1 || losers[0].id !== final.loserId) fail('il doit y avoir un seul perdant');
const loser = losers[0];
if (final.reason === 'collection' && loser.piles[final.animal] !== 4) fail('la collection du perdant ne compte pas quatre bestioles');
if (final.reason === 'empty' && loser.handCount !== 0) fail('le perdant avait encore des cartes');
console.log(`✓ partie terminée : ${loser.name} perd (${final.reason === 'collection' ? `quatre ${final.animal}s` : 'main vide'})`);

await a.call('game:restart');
await new Promise((r) => setTimeout(r, 150));
if (a.view.phase !== 'lobby') fail('retour au salon échoué');
console.log('✓ retour au salon pour une revanche');

for (const c of [a, b2, d, spy]) c.socket.close();
server.kill();
console.log('✓ test de bout en bout réussi');
process.exit(0);
