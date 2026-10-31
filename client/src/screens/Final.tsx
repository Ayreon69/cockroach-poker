// Fin de partie : le perdant reçoit son tampon, tous les autres gagnent, puis les vitrines, les distinctions et la revanche.
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { LogOut, RotateCcw } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { FinalEntry, RoomView } from '../../../shared/protocol';
import { BEASTS, Medallion, PileRow } from '../components/Beasts';
import { Button, Cabinet, Logo } from '../components/Ui';
import { sfx } from '../lib/sound';
import { cls, plural } from '../lib/util';
import { leaveRoom, send } from '../net';

interface Award {
  title: string;
  entry: FinalEntry;
  detail: string;
}

function awards(entries: FinalEntry[]): Award[] {
  const best = (score: (f: FinalEntry) => number) => {
    const sorted = [...entries].sort((a, b) => score(b) - score(a));
    return sorted.length && score(sorted[0]) > 0 && (sorted.length < 2 || score(sorted[0]) > score(sorted[1])) ? sorted[0] : null;
  };
  const say = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
  const list: Award[] = [];
  const marble = best((f) => f.stats.fooled);
  if (marble) list.push({ title: 'Visage de marbre', entry: marble, detail: `${plural(marble.stats.fooled, 'victime')} de ses annonces` });
  const lynx = best((f) => f.stats.reads);
  if (lynx) list.push({ title: 'Œil de lynx', entry: lynx, detail: say(lynx.stats.reads, 'bonne réponse', 'bonnes réponses') });
  const liar = best((f) => f.stats.lies);
  if (liar) list.push({ title: 'Menteur patenté', entry: liar, detail: say(liar.stats.lies, 'annonce fausse', 'annonces fausses') });
  const potato = best((f) => f.stats.passes);
  if (potato) list.push({ title: 'Patate chaude', entry: potato, detail: say(potato.stats.passes, 'carte regardée puis refilée', 'cartes regardées puis refilées') });
  const gull = best((f) => f.stats.misreads);
  if (gull) list.push({ title: 'Bon public', entry: gull, detail: `${plural(gull.stats.misreads, 'réponse')} à côté` });
  return list;
}

export function Final({ view }: { view: RoomView }) {
  const final = view.final;
  const isHost = view.hostId === view.me;
  const once = useRef(false);
  const loser = final?.entries.find((e) => e.id === final.loserId);
  const iLost = final?.loserId === view.me;
  const iPlayed = !!final?.entries.some((e) => e.id === view.me);

  useEffect(() => {
    if (once.current || !final) return;
    once.current = true;
    if (iLost) sfx.lose();
    else {
      sfx.win();
      if (iPlayed) {
        const colors = ['#c9a24a', '#2f7a64', '#f1e6cc', '#b8341f'];
        void confetti({ particleCount: 140, spread: 95, origin: { y: 0.35 }, colors, disableForReducedMotion: true });
        setTimeout(() => void confetti({ particleCount: 70, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors, disableForReducedMotion: true }), 450);
        setTimeout(() => void confetti({ particleCount: 70, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors, disableForReducedMotion: true }), 750);
      }
    }
  }, [final, iLost, iPlayed]);

  if (!final || !loser) {
    return (
      <Cabinet className="is-quiet">
        <div className="final">
          <p className="waiting" role="status">
            <span className="spinner" /> La partie s'achève…
          </p>
          {isHost && (
            <Button variant="primary" icon={<RotateCcw size={20} />} onClick={() => void send('game:restart')}>
              Retour au salon
            </Button>
          )}
        </div>
      </Cabinet>
    );
  }

  const beast = final.animal ? BEASTS[final.animal] : null;
  const reason =
    final.reason === 'collection' && beast
      ? iLost
        ? `${view.loseAt === 5 ? 'Cinq' : 'Quatre'} ${beast.plural} devant toi : le cabinet te remercie pour ta magnifique collection.`
        : `Le cabinet remercie ${loser.name} pour sa magnifique collection de ${beast.plural}.`
      : iLost
        ? 'Tu devais lancer une carte… mais ta main était vide.'
        : `${loser.name} devait lancer une carte… mais n'avait plus rien en main.`;
  const list = awards(final.entries);

  return (
    <Cabinet className="is-quiet">
      <div className="final">
        <header className="final-top">
          <Logo size="sm" />
          <Button variant="ghost" icon={<LogOut size={18} />} onClick={() => void leaveRoom()}>
            Quitter
          </Button>
        </header>

        <section className={cls('final-hero', iLost ? 'is-lost' : 'is-won')}>
          <div className="final-portrait">
            <Medallion avatar={loser.avatar} size="lg" />
            <motion.span className="stamp is-wrong final-stamp" initial={{ scale: 3, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: -14 }} transition={{ delay: 0.35, type: 'spring', stiffness: 420, damping: 16 }}>
              Perdant
            </motion.span>
          </div>
          <h1>{iLost ? 'Tu as perdu…' : iPlayed ? 'Tu gagnes !' : `${loser.name} perd la partie`}</h1>
          <p className="final-sub">{iLost ? 'Et tous les autres gagnent.' : iPlayed ? `Avec tous les autres : ${loser.name} est le seul perdant.` : 'Tous les autres gagnent.'}</p>
          <p className="final-reason">{reason}</p>
        </section>

        <section className="final-grid">
          <div className="sheet">
            <h3>Les vitrines</h3>
            <ul className="final-list">
              {final.entries.map((e, i) => (
                <motion.li key={e.id} className={cls('final-row', e.loser && 'is-loser', e.id === view.me && 'is-me')} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.06 }}>
                  <Medallion avatar={e.avatar} size="sm" />
                  <span className="final-name">
                    {e.name}
                    {e.id === view.me && <span className="muted"> (toi)</span>}
                    <small className="muted">{e.loser ? 'perd' : 'gagne'}</small>
                  </span>
                  <PileRow piles={e.piles} size="xs" />
                </motion.li>
              ))}
            </ul>
          </div>

          {list.length > 0 && (
            <div className="sheet">
              <h3>Distinctions</h3>
              <ul className="award-list">
                {list.map((a) => (
                  <li key={a.title} className="award">
                    <Medallion avatar={a.entry.avatar} size="sm" />
                    <div>
                      <b>{a.title}</b>
                      <span className="muted small">
                        {a.entry.name} : {a.detail}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="lobby-cta">
          {isHost ? (
            <Button variant="primary" className="btn-lg btn-wide" icon={<RotateCcw size={20} />} onClick={() => void send('game:restart')}>
              Revanche
            </Button>
          ) : (
            <div className="waiting" role="status">
              <span className="spinner" /> En attente de la revanche…
            </div>
          )}
        </div>
      </div>
    </Cabinet>
  );
}
