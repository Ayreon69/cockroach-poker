// La table : les vitrines des autres en haut ; en bas, le trajet de la carte, ta main et tes décisions.
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Eye, Flag, MoreHorizontal, Send, Smile, ThumbsDown, ThumbsUp, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ANIMALS, EMOTES, TAUNTS, type Animal, type PlayerView, type RoomView, type RoundView } from '../../../shared/protocol';
import { BEASTS, BeastArt, CardBack, CardFace, FlipCard, Medallion, PileRow, claimText, quote } from '../components/Beasts';
import { Button, Cabinet, Modal, Pill } from '../components/Ui';
import { sfx } from '../lib/sound';
import { cls, secondsLeft, useTick, vibrate } from '../lib/util';
import { leaveRoom, send, socket } from '../net';
import { serverNow, useStore, type Emote } from '../store';
import { RevealStage } from './Reveal';

type Who = (id: string | null | undefined) => PlayerView | undefined;

function Bubble({ emotes }: { emotes: Emote[] }) {
  const last = emotes[emotes.length - 1];
  if (!last) return null;
  return (
    <span key={last.id} className={cls('bubble', last.emoji.length > 3 && 'is-text')} role="status">
      {last.emoji}
    </span>
  );
}

function TurnTimer({ endsAt, think }: { endsAt: number; think: number }) {
  const now = useTick(250);
  if (!endsAt || !think) return null;
  const left = Math.max(0, endsAt - now);
  return (
    <span className="turn-timer" role="timer" aria-label={`${secondsLeft(endsAt, now)} secondes`}>
      <span style={{ width: `${Math.min(100, (left / (think * 1000)) * 100)}%` }} />
    </span>
  );
}

/** Ce que fait le joueur dont on attend la décision, en quelques mots. */
function doing(r: RoundView): string {
  if (r.phase === 'give') return 'choisit une carte…';
  if (r.phase === 'peek') return 'cherche à qui la refiler…';
  return 'hésite…';
}

/** La vitrine d'un adversaire : son portrait, ses cartes en main, sa collection face visible. */
function Vitrine({ p, r, think, emotes, pickable, picked, onPick }: { p: PlayerView; r: RoundView; think: number; emotes: Emote[]; pickable: boolean; picked: boolean; onPick: () => void }) {
  const acting = r.actorId === p.id;
  const holder = (r.phase === 'answer' || r.phase === 'peek') && r.path[r.path.length - 1] === p.id;
  const seen = r.phase !== 'reveal' && r.phase !== 'give' && r.seenIds.includes(p.id) && !holder;
  const label = `${p.name}, ${p.handCount} carte${p.handCount > 1 ? 's' : ''} en main${acting ? `, ${doing(r)}` : ''}`;
  const body = (
    <>
      <Bubble emotes={emotes} />
      <Medallion avatar={p.avatar} className="vit-medal" />
      <span className="vit-head">
        <span className="vit-name">{p.name}</span>
        <span className="vit-meta">
          <span className="vit-hand" title="Cartes en main">
            <CardBack size="xs" className="vit-hand-card" />
            {p.handCount}
          </span>
          {holder && (
            <span className="vit-mark is-holder" title="Tient la carte">
              <CardBack size="xs" /> la tient
            </span>
          )}
          {seen && (
            <span className="vit-mark is-seen" title="A vu la carte">
              <Eye size={14} /> l'a vue
            </span>
          )}
        </span>
      </span>
      <PileRow piles={p.piles} size="xs" className="vit-piles" empty="" />
      {acting && <span className="vit-doing">{doing(r)}</span>}
      {p.autopilot && <span className="vit-auto">Pilote auto</span>}
      {!p.connected && !p.autopilot && <span className="vit-auto">Hors ligne</span>}
      {acting && <TurnTimer endsAt={r.turnEndsAt} think={think} />}
    </>
  );
  const className = cls('vitrine', acting && 'is-acting', holder && 'is-holder', pickable && 'is-pickable', picked && 'is-picked');
  if (pickable)
    return (
      <button type="button" className={className} aria-label={`Choisir ${label}`} aria-pressed={picked} onClick={onPick} data-player={p.id}>
        {body}
      </button>
    );
  return (
    <div className={className} aria-label={label} role="group" data-player={p.id}>
      {body}
    </div>
  );
}

/**
 * Le centre de la table : la carte en transit, son trajet (qui l'a eue, qui l'a vue) et la seule annonce qui compte.
 * Rien des tours précédents : se souvenir fait partie du jeu.
 */
function Stage({ view, r, who }: { view: RoomView; r: RoundView; who: Who }) {
  const name = (id: string | null | undefined) => (id === view.me ? 'Toi' : who(id)?.name ?? '?');
  const actor = who(r.actorId);
  if (r.phase === 'give') {
    return (
      <div className="stage is-give" aria-live="polite">
        <span className="stage-card is-waiting">
          <CardBack size="md" />
        </span>
        <p className="stage-line">
          <b>{actor?.name}</b> choisit une carte et une victime…
        </p>
      </div>
    );
  }
  const holderId = r.path[r.path.length - 1];
  const iSaw = !!r.card && r.seenIds.includes(view.me) && r.phase !== 'reveal';
  let line: string;
  if (r.phase === 'peek') line = `${name(r.actorId)} a regardé la carte et cherche à qui la refiler…`;
  else if (holderId === view.me) line = 'Tout le monde te regarde…';
  else line = `${name(holderId)} hésite…`;
  return (
    <div className="stage" aria-live="polite">
      <ol className="trip-path" aria-label="Trajet de la carte">
        {r.path.map((id, i) => {
          const p = who(id);
          const isHolder = i === r.path.length - 1;
          const saw = r.seenIds.includes(id) && !(isHolder && r.phase === 'answer');
          return (
            <li key={id} className={cls('trip-node', isHolder && 'is-holder', id === view.me && 'is-me')}>
              {i > 0 && <ArrowRight className="trip-arrow" size={14} aria-hidden />}
              <span className="trip-who">
                <Medallion avatar={p?.avatar ?? 'hibou'} size="sm" />
                <span className="trip-mark" aria-hidden>
                  {saw ? <Eye size={12} /> : isHolder ? <CardBack size="xs" /> : null}
                </span>
              </span>
              <span className="trip-name">
                {name(id)}
                <span className="sr-only">{saw ? ' : a vu la carte' : isHolder ? ' : tient la carte' : ''}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="stage-center">
        <span className={cls('stage-card', iSaw && 'is-known')}>
          {iSaw && r.card ? <CardFace animal={r.card} size="md" /> : <CardBack size="md" />}
          {iSaw && (
            <span className="stage-seen">
              <Eye size={12} /> tu l'as vue
            </span>
          )}
        </span>
        {r.claim && (
          <motion.p key={`${r.path.length}-${r.claim}`} className="claim-bubble" style={{ '--c': BEASTS[r.claim].color } as CSSProperties} initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 20 }}>
            <span className="claim-by">{name(r.claimerId)} :</span>
            <BeastArt animal={r.claim} className="claim-bubble-art" />
            <span className="claim-words">{quote(claimText(r.claim))}</span>
          </motion.p>
        )}
      </div>
      <p className={cls('stage-line', holderId === view.me && r.phase === 'answer' && 'is-mine')}>{line}</p>
    </div>
  );
}

/** La carte qu'on vient de regarder : elle se retourne sous tes yeux, et pour toi seul. */
function PeekCard({ animal }: { animal: Animal }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 60);
    return () => clearTimeout(t);
  }, []);
  return <FlipCard animal={animal} shown={shown} size="md" />;
}

/** Huit grandes planches pour annoncer une bestiole. */
function ClaimGrid({ value, onChange }: { value: Animal | null; onChange: (a: Animal) => void }) {
  return (
    <div className="claim-grid" role="radiogroup" aria-label="Bestiole annoncée">
      {ANIMALS.map((a) => (
        <button key={a} type="button" role="radio" aria-checked={value === a} aria-label={`Annoncer : ${BEASTS[a].name}`} className={cls('claim-opt', value === a && 'is-on')} style={{ '--c': BEASTS[a].color } as CSSProperties} onClick={() => onChange(a)}>
          <BeastArt animal={a} className="claim-art" />
          <span>{BEASTS[a].name}</span>
        </button>
      ))}
    </div>
  );
}

function TargetChips({ ids, value, onChange, who }: { ids: string[]; value: string | null; onChange: (id: string) => void; who: Who }) {
  return (
    <div className="targets" role="radiogroup" aria-label="À qui ?">
      {ids.map((id) => {
        const p = who(id);
        if (!p) return null;
        return (
          <button key={id} type="button" role="radio" aria-checked={value === id} aria-label={`À ${p.name}`} className={cls('target', value === id && 'is-on')} onClick={() => onChange(id)}>
            <Medallion avatar={p.avatar} size="sm" />
            <span>{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Ta main, rangée en colonnes par bestiole : on compte ses cartes comme on les tiendrait. */
function Hand({ hand, selectable, selected, onSelect }: { hand: Animal[]; selectable: boolean; selected: Animal | null; onSelect: (a: Animal) => void }) {
  const groups = ANIMALS.map((a) => [a, hand.filter((h) => h === a).length] as const).filter(([, n]) => n > 0);
  if (!groups.length) return <p className="hand-empty">Ta main est vide.</p>;
  return (
    <div className={cls('hand', selectable && 'is-selectable')} role={selectable ? 'radiogroup' : 'list'} aria-label="Ta main">
      {groups.map(([a, n]) => {
        const cards = Array.from({ length: n }, (_, i) => <CardFace key={i} animal={a} size="sm" className="hand-card" style={{ '--i': i } as CSSProperties} />);
        const label = `${BEASTS[a].name} : ${n} en main`;
        const style = { '--n': n } as CSSProperties;
        return selectable ? (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={selected === a}
            aria-label={label}
            className={cls('hand-group', selected === a && 'is-on')}
            style={style}
            onClick={() => {
              onSelect(a);
              sfx.pick();
            }}
          >
            {cards}
          </button>
        ) : (
          <span key={a} role="listitem" aria-label={label} className="hand-group" style={style}>
            {cards}
          </span>
        );
      })}
    </div>
  );
}

/** Le plateau de réactions : un volet posé au-dessus de tout, qu'un appui à côté ou Échap referme. */
function ReactionTray({ onClose }: { onClose: () => void }) {
  const emit = (emoji: string) => {
    socket.emit('emote', { emoji });
    onClose();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
    <div className="reactions-back" onClick={onClose} aria-hidden />
    <div className="reactions" role="dialog" aria-label="Réactions">
      <div className="reaction-emojis">
        {EMOTES.map((e) => (
          <button key={e} type="button" onClick={() => emit(e)} aria-label={`Réaction ${e}`}>
            {e}
          </button>
        ))}
      </div>
      <div className="reaction-taunts">
        {TAUNTS.map((t) => (
          <button key={t} type="button" onClick={() => emit(t)}>
            {t}
          </button>
        ))}
      </div>
    </div>
    </>
  );
}

interface Selection {
  key: string;
  card: Animal | null;
  target: string | null;
  claim: Animal | null;
}

/** L'heure de ta dernière décision envoyée : sert à savoir si le pilote a joué à ta place. */
let lastActAt = 0;

/** Ton tour s'achève sans que tu aies rien envoyé, chrono écoulé : on te dit que le pilote a joué pour toi. */
function useAutopilotNotice(view: RoomView) {
  const r = view.round;
  const mine = useRef<{ key: string; endsAt: number; since: number } | null>(null);
  const key = r ? `${r.number}:${r.phase}:${r.actorId}` : '';
  useEffect(() => {
    if (!r) return;
    const was = mine.current;
    if (was && was.key !== key && was.endsAt > 0 && lastActAt < was.since && serverNow() >= was.endsAt - 1500) {
      useStore.getState().showToast('Temps écoulé : le pilote automatique a joué pour toi.', 'info');
    }
    mine.current = r.actorId === view.me ? { key, endsAt: r.turnEndsAt, since: Date.now() } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Sons, vibrations et titre de l'onglet : ils se déduisent des changements d'état reçus du serveur. */
function useTableEffects(view: RoomView) {
  useAutopilotNotice(view);
  const r = view.round;
  const prev = useRef<{ n: number; phase: string; actor: string | null; len: number } | null>(null);
  useEffect(() => {
    if (!r) return;
    const last = prev.current;
    const same = last && last.n === r.number;
    if (same && r.path.length > last.len) sfx.slide();
    if (same && last.phase === 'answer' && r.phase === 'peek') sfx.peek();
    const mine = r.actorId === view.me && r.phase !== 'peek';
    if (mine && (!last || last.actor !== view.me || last.phase !== r.phase || last.n !== r.number)) {
      sfx.turn();
      vibrate(30);
    }
    prev.current = { n: r.number, phase: r.phase, actor: r.actorId, len: r.path.length };
  }, [r, view.me]);
  const mine = r?.actorId === view.me;
  useEffect(() => {
    document.title = mine ? '● À toi ! · Cockroach Poker' : 'Cockroach Poker';
    return () => {
      document.title = 'Cockroach Poker';
    };
  }, [mine]);
}

export function Table({ view }: { view: RoomView }) {
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const setRulesOpen = useStore((s) => s.setRulesOpen);
  const emotes = useStore((s) => s.emotes);
  const [menu, setMenu] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [react, setReact] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Selection>({ key: '', card: null, target: null, claim: null });
  useTableEffects(view);

  const r = view.round;
  if (!r) {
    return (
      <Cabinet>
        <p className="waiting" role="status">
          <span className="spinner" /> On distribue les cartes…
        </p>
      </Cabinet>
    );
  }

  const who: Who = (id) => view.players.find((p) => p.id === id);
  const me = who(view.me);
  const playing = view.players.filter((p) => p.status === 'playing');
  // On tourne la table pour que les voisins qui jouent après toi viennent en premier.
  const myIndex = playing.findIndex((p) => p.id === view.me);
  const others = myIndex < 0 ? playing : [...playing.slice(myIndex + 1), ...playing.slice(0, myIndex)];
  const isHost = view.hostId === view.me;
  const myTurn = r.actorId === view.me;
  const giving = myTurn && r.phase === 'give';
  const passing = myTurn && r.phase === 'peek';
  const answering = myTurn && r.phase === 'answer';
  const choosing = giving || passing;

  // La sélection appartient à une décision précise : elle s'efface d'elle-même quand la situation change.
  const key = `${r.number}:${r.phase}:${r.actorId}`;
  const fresh: Selection = { key, card: null, target: r.targets.length === 1 ? r.targets[0] : null, claim: null };
  const current: Selection = sel.key === key ? sel : fresh;
  // Toujours à partir de l'état le plus récent : deux appuis rapprochés ne doivent rien perdre.
  const update = (patch: Partial<Selection>) => setSel((prev) => ({ ...(prev.key === key ? prev : fresh), ...patch }));
  const card = passing ? r.card : current.card;
  const ready = !!card && !!current.target && !!current.claim;
  const targetName = who(current.target)?.name;

  const act = async (event: string, payload: Record<string, unknown> = {}) => {
    if (busy) return;
    setBusy(true);
    lastActAt = Date.now();
    await send(event, payload);
    setBusy(false);
  };

  const claimer = who(r.claimerId);

  const meZone =
    me && me.status === 'playing' && view.hand ? (
      <div className="me-zone">
        <div className="me-head">
          <Bubble emotes={emotes.filter((e) => e.playerId === view.me)} />
          <Medallion avatar={me.avatar} size="sm" />
          <b className="me-name">Toi</b>
          <PileRow piles={me.piles} size="xs" className="me-piles" empty="Aucune bestiole devant toi" />
          <button type="button" className={cls('icon-btn react-btn', react && 'is-on')} aria-label="Réagir" aria-expanded={react} onClick={() => setReact((x) => !x)}>
            <Smile size={20} />
          </button>
          {react && <ReactionTray onClose={() => setReact(false)} />}
        </div>
        {giving && <p className="step-label">1. Ta carte</p>}
        <Hand hand={view.hand} selectable={giving} selected={current.card} onSelect={(a) => update({ card: a })} />
      </div>
    ) : (
      <p className="me-off">{me?.status === 'spectator' ? 'Tu regardes la partie : aucune carte ne t’est montrée.' : 'Tu observes.'}</p>
    );

  let status = '';
  if (giving) status = 'À toi ! Glisse une carte face cachée.';
  else if (answering) status = `${claimer?.name ?? '?'} te glisse une carte : vrai ou faux ?`;
  else if (passing) status = 'Tu as regardé : à qui la refiles-tu ?';

  return (
    <div className={cls('table-screen', myTurn && 'is-my-turn')}>
      <header className="table-top">
        <span className="table-code">
          Table <b>{view.code}</b>
        </span>
        <div className="table-tools">
          <button type="button" className="icon-btn" aria-label="Les règles" onClick={() => setRulesOpen(true)}>
            <BookOpen size={20} />
          </button>
          <button type="button" className="icon-btn" aria-label={prefs.sound ? 'Couper le son' : 'Activer le son'} onClick={() => setPrefs({ sound: !prefs.sound })}>
            {prefs.sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button type="button" className="icon-btn" aria-label="Menu" onClick={() => setMenu(true)}>
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      <main className={cls('board', choosing && 'is-choosing')}>
        <div className={cls('vitrines', `has-${others.length}`)} aria-label="Les autres joueurs">
          {others.map((p) => (
            <Vitrine
              key={p.id}
              p={p}
              r={r}
              think={view.settings.think}
              emotes={emotes.filter((e) => e.playerId === p.id)}
              pickable={choosing && r.targets.includes(p.id)}
              picked={choosing && current.target === p.id}
              onPick={() => update({ target: p.id })}
            />
          ))}
        </div>
        {!choosing && <Stage view={view} r={r} who={who} />}
      </main>

      <section className={cls('dock', myTurn && 'is-turn')} aria-label="Ta place">
        <div className="dock-inner">
          {myTurn && (
            <div className="status is-mine" role="status">
              <p className="status-line">{status}</p>
              <TurnTimer endsAt={r.turnEndsAt} think={view.settings.think} />
            </div>
          )}

          {/* Pour refiler, la main ne sert pas : la carte regardée et les choix passent devant. */}
          {!passing && meZone}

          {choosing && (
            <div className="actions">
              {passing && r.card && (
                <div className="peeked">
                  <PeekCard animal={r.card} />
                  <p>
                    C'est <b>{BEASTS[r.card].un}</b>.<br />
                    <span className="muted small">
                      {claimer?.name ?? '?'} annonçait {quote(r.claim ? BEASTS[r.claim].name.toLowerCase() : '?')}. À toi d'annoncer ce que tu veux.
                    </span>
                  </p>
                </div>
              )}
              <p className="step-label">{giving ? '2. À qui ?' : 'À qui ? (quelqu’un qui ne l’a pas vue)'}</p>
              <TargetChips ids={r.targets} value={current.target} onChange={(id) => update({ target: id })} who={who} />
              <p className="step-label">{giving ? '3. Ton annonce' : 'Ton annonce'}</p>
              <ClaimGrid value={current.claim} onChange={(a) => update({ claim: a })} />
              <Button
                variant="primary"
                className="btn-lg btn-wide send-btn"
                icon={<Send size={18} />}
                disabled={!ready || busy}
                onClick={() => void act(giving ? 'game:give' : 'game:pass', giving ? { card, to: current.target, claim: current.claim } : { to: current.target, claim: current.claim })}
              >
                {ready ? `${giving ? 'Glisser' : 'Refiler'} à ${targetName} : ${quote(claimText(current.claim!))}` : !card ? 'Choisis une carte' : !current.target ? 'Choisis à qui' : 'Choisis ton annonce'}
              </Button>
            </div>
          )}

          {passing && meZone}

          {answering && r.claim && (
            <div className="actions">
              <div className={cls('answer-row', r.canPeek && 'has-peek')}>
                <Button variant="true" className="btn-lg" icon={<ThumbsUp size={20} />} disabled={busy} onClick={() => void act('game:answer', { truth: true })}>
                  C'est vrai
                </Button>
                <Button variant="false" className="btn-lg" icon={<ThumbsDown size={20} />} disabled={busy} onClick={() => void act('game:answer', { truth: false })}>
                  C'est faux
                </Button>
                {r.canPeek && (
                  <Button variant="peek" className="btn-wide peek-btn" icon={<Eye size={18} />} disabled={busy} onClick={() => void act('game:peek')}>
                    Regarder et passer
                  </Button>
                )}
              </div>
              {!r.canPeek && <p className="must-answer">{playing.length === 2 ? 'À deux, on ne repasse pas les cartes : réponds.' : 'Tout le monde l’a déjà vue : tu dois répondre.'}</p>}
            </div>
          )}
        </div>
      </section>

      {r.phase === 'reveal' && r.reveal && <RevealStage key={r.number} view={view} r={r} />}

      <Modal
        open={menu}
        onClose={() => {
          setMenu(false);
          setConfirmStop(false);
        }}
        title="Menu"
      >
        <div className="menu-list">
          <Button icon={prefs.sound ? <Volume2 size={18} /> : <VolumeX size={18} />} onClick={() => setPrefs({ sound: !prefs.sound })}>
            Son : {prefs.sound ? 'activé' : 'coupé'}
          </Button>
          <Button
            icon={<BookOpen size={18} />}
            onClick={() => {
              setMenu(false);
              setRulesOpen(true);
            }}
          >
            Les règles
          </Button>
          {isHost && (
            <Button
              variant="danger"
              icon={<Flag size={18} />}
              onClick={() => {
                // Deux appuis : un geste malheureux ne doit pas couper la partie de toute la table.
                if (!confirmStop) {
                  setConfirmStop(true);
                  return;
                }
                setConfirmStop(false);
                setMenu(false);
                void send('game:end');
              }}
            >
              {confirmStop ? 'Confirmer : arrêter pour tout le monde' : 'Arrêter la partie'}
            </Button>
          )}
          <Button variant="ghost" onClick={() => void leaveRoom()}>
            Quitter la table
          </Button>
          {me?.status === 'spectator' && <Pill>Spectateur</Pill>}
        </div>
      </Modal>
    </div>
  );
}
