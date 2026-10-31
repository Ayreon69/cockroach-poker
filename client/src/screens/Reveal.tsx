// La révélation : la réponse claque, la carte se retourne, le tampon tombe, et quelqu'un repart avec la bestiole.
// Tout se déduit de l'état du serveur : la scène disparaît d'elle-même quand le tour suivant commence.
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { Reveal, RoomView, RoundView } from '../../../shared/protocol';
import { BEASTS, CardFace, FlipCard, Medallion, claimText, quote } from '../components/Beasts';
import { Button } from '../components/Ui';
import { sfx } from '../lib/sound';
import { cls, secondsLeft, seeded, useTick, vibrate } from '../lib/util';
import { send } from '../net';
import { serverNow } from '../store';

/** Le temps de la réponse, du retournement et du tampon. Le serveur attend au moins autant avant d'enchaîner. */
const FLIP_AT = 550;
const STAMP_AT = 1300;
const LINE_AT = 1650;

const TITLES = {
  /** Il a dit « faux », c'était un mensonge. */
  unmasked: ['Démasqué !', 'Bluff éventé !', 'Pris la patte dans le sac !'],
  /** Il a dit « vrai », c'était vrai. */
  trusted: ['Bien vu !', "Flair d'entomologiste !", 'Rien ne lui échappe !'],
  /** Il a dit « vrai », c'était un mensonge. */
  fooled: ['Gobé !', 'Avalé tout rond !', "Mordu à l'hameçon !"],
  /** Il a dit « faux », c'était vrai. */
  doubted: ['Et pourtant, c’était vrai !', 'Trop méfiant !', 'La vérité, ça trompe aussi !'],
};

function title(rv: Reveal, seed: number): string {
  if (rv.right) return seeded(rv.truth ? TITLES.trusted : TITLES.unmasked, seed);
  return seeded(rv.truth ? TITLES.doubted : TITLES.fooled, seed);
}

export function RevealStage({ view, r }: { view: RoomView; r: RoundView }) {
  const rv = r.reveal!;
  const now = useTick(250);
  // Arrivé après le spectacle (page rechargée) : on montre directement le verdict.
  const [late] = useState(() => serverNow() >= r.revealMinAt - 400);
  const [stage, setStage] = useState(late ? 3 : 0);
  const me = view.me;
  const name = (id: string | null) => view.players.find((p) => p.id === id)?.name ?? '?';
  const avatar = (id: string | null) => view.players.find((p) => p.id === id)?.avatar ?? 'hibou';
  const mineTaken = rv.takerId === me;
  const involved = rv.receiverId === me || rv.claimerId === me;

  // Une seule fois par tour : chaque diffusion du serveur ne doit pas relancer la scène.
  useEffect(() => {
    if (late) return;
    const ids: ReturnType<typeof setTimeout>[] = [];
    ids.push(
      setTimeout(() => {
        setStage(1);
        sfx.flip();
      }, FLIP_AT),
    );
    ids.push(
      setTimeout(() => {
        setStage(2);
        sfx.stamp();
        if (involved) vibrate(mineTaken ? [60, 40, 140] : 40);
      }, STAMP_AT),
    );
    ids.push(
      setTimeout(() => {
        setStage(3);
        if (rv.loserId) {
          if (rv.loserId === me) sfx.lose();
          else sfx.win();
        } else if (mineTaken) sfx.bad();
        else if (involved) {
          sfx.good();
          void confetti({ particleCount: 50, spread: 60, origin: { y: 0.55 }, colors: ['#c9a24a', '#2f7a64', '#f1e6cc', '#b8341f'], disableForReducedMotion: true });
        }
      }, LINE_AT),
    );
    return () => ids.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const b = BEASTS[rv.card];
  const said = rv.said ? "C'est vrai !" : "C'est faux !";
  const tone = rv.right ? 'right' : 'wrong';
  const taker = rv.takerId === me ? 'Tu prends' : `${name(rv.takerId)} prend`;
  const canReady = view.players.find((p) => p.id === me)?.status === 'playing';
  const isReady = r.readyIds.includes(me);
  const left = secondsLeft(r.revealEndsAt, now);
  const ending = !!rv.loserId;

  let endLine = '';
  if (rv.loserId && rv.endReason === 'collection') {
    endLine = rv.loserId === me ? `Ta collection de ${b.plural} est complète : tu perds la partie !` : `La collection de ${b.plural} de ${name(rv.loserId)} est complète : ${name(rv.loserId)} perd la partie !`;
  } else if (rv.loserId && rv.endReason === 'empty') {
    endLine = rv.loserId === me ? 'Tu dois lancer la carte suivante… mais ta main est vide : perdu !' : `${name(rv.loserId)} doit lancer la carte suivante… mais n'a plus rien en main : perdu !`;
  }

  return (
    <div className={cls('reveal', stage >= 3 && `is-${mineTaken ? 'bad' : involved ? 'good' : 'neutral'}`, ending && 'is-ending')} role="dialog" aria-modal="false" aria-label="La carte se retourne">
      <div className="reveal-box">
        <p className="reveal-said">
          <Medallion avatar={avatar(rv.claimerId)} size="sm" />
          <span>
            <b>{rv.claimerId === me ? 'Toi' : name(rv.claimerId)}</b> : {quote(claimText(rv.claim))}
          </span>
        </p>
        <motion.p className={cls('reveal-answer', rv.said ? 'is-true' : 'is-false')} initial={late ? false : { scale: 1.8, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: -2 }} transition={{ type: 'spring', stiffness: 480, damping: 18 }}>
          <Medallion avatar={avatar(rv.receiverId)} size="sm" />
          <span>
            <small>{rv.receiverId === me ? 'Toi' : name(rv.receiverId)} :</small> {quote(said)}
          </span>
        </motion.p>

        <div className="reveal-card">
          <FlipCard animal={rv.card} shown={stage >= 1} size="lg" />
          {stage >= 2 && (
            <motion.span className={cls('stamp', `is-${tone}`)} initial={late ? false : { scale: 2.6, opacity: 0, rotate: -24 }} animate={{ scale: 1, opacity: 1, rotate: -12 }} transition={{ type: 'spring', stiffness: 520, damping: 17 }}>
              {title(rv, r.number)}
            </motion.span>
          )}
        </div>

        <div className="reveal-foot" aria-live="polite">
          {stage >= 3 ? (
            <motion.div initial={late ? false : { y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.25 }}>
              <p className="reveal-truth">
                C'était {rv.truth ? 'vrai' : <>faux : c'est {b.un}</>}.
              </p>
              <p className="reveal-taker">
                <Medallion avatar={avatar(rv.takerId)} size="sm" />
                <span>
                  {taker} {b.le}.
                </span>
                <CardFace animal={rv.card} size="xs" />
              </p>
              {endLine && <p className="reveal-end">{endLine}</p>}
              {canReady ? (
                <Button variant="primary" className="btn-wide" disabled={isReady} onClick={() => void send('game:next')}>
                  {isReady ? `On attend les autres… ${left}` : `${ending ? 'Voir la fin' : 'Continuer'} · ${left}`}
                </Button>
              ) : (
                <p className="muted small">Suite dans {left} s</p>
              )}
            </motion.div>
          ) : (
            <p className="reveal-wait">…</p>
          )}
        </div>
      </div>
    </div>
  );
}
