// Règles illustrées, lisibles en une minute.
import { ArrowRight, Eye } from 'lucide-react';
import { ANIMALS } from '../../../shared/protocol';
import { useStore } from '../store';
import { BEASTS, CardBack, CardFace } from './Beasts';
import { Modal } from './Ui';

export function RulesModal() {
  const open = useStore((s) => s.rulesOpen);
  const setOpen = useStore((s) => s.setRulesOpen);
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Les règles en 1 minute" wide>
      <div className="rules">
        <section className="rule-hero">
          <div className="rule-hero-cards" aria-hidden>
            <CardBack size="sm" />
            <ArrowRight size={18} />
            <span className="rule-quote">« C'est un crapaud ! »</span>
          </div>
          <p>
            Glisse une carte <b>face cachée</b> à qui tu veux en annonçant une bestiole. <b>Vraie ou fausse</b> : à l'autre de deviner. Celui qui se retrouve avec <b>quatre bestioles identiques</b> devant lui a perdu.
          </p>
        </section>

        <section>
          <h3>Tu reçois une carte : deux choix</h3>
          <div className="rule-split">
            <div className="rule-case">
              <h4>Répondre</h4>
              <p>
                « <b>C'est vrai</b> » ou « <b>c'est faux</b> », puis on retourne la carte. Tu as vu juste : celui qui te l'a glissée la reprend. Tu t'es trompé : elle est pour toi.
              </p>
            </div>
            <div className="rule-case">
              <h4>
                <Eye size={16} /> Regarder et passer
              </h4>
              <p>Tu regardes la carte en secret, puis tu la glisses à quelqu'un qui ne l'a pas encore vue, avec la même annonce ou une autre. Quand tout le monde l'a vue, le dernier doit répondre.</p>
            </div>
          </div>
        </section>

        <section>
          <h3>Ensuite</h3>
          <p>
            Celui qui prend la carte la pose <b>face visible</b> devant lui, avec ses semblables, et c'est lui qui lance la carte suivante. Si à ce moment-là il n'a <b>plus de carte en main</b>, il a perdu. Un seul perdant : tous les autres gagnent.
          </p>
        </section>

        <section className="rule-duo">
          <h3>À deux</h3>
          <p>Dix cartes sont écartées sans être regardées, on ne repasse jamais une carte, et l'on perd à cinq bestioles identiques.</p>
        </section>

        <section>
          <h3>Les pensionnaires du cabinet</h3>
          <p className="muted small">Huit bestioles, huit exemplaires de chacune : 64 cartes.</p>
          <ul className="rule-gallery">
            {ANIMALS.map((a) => (
              <li key={a}>
                <CardFace animal={a} size="sm" />
                <span>
                  <b>{BEASTS[a].name}</b>
                  <i>{BEASTS[a].latin}</i>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rule-tips">
          <h3>Pour bien jouer</h3>
          <ul>
            <li>
              <b>Regarde les vitrines :</b> les piles de chacun disent où ça fait mal.
            </li>
            <li>
              <b>Retiens :</b> seule l'annonce en cours reste affichée. Le reste, c'est dans ta tête.
            </li>
            <li>
              <b>Mens… ou pas :</b> la vérité dite avec aplomb trompe aussi bien qu'un mensonge.
            </li>
          </ul>
        </section>

        <p className="rule-foot">
          D'après <i>Cockroach Poker</i> (<i>Kakerlakenpoker</i>), de Jacques Zeimet, édité par Drei Magier Spiele. Création de fans, non officielle, avec ses propres illustrations. Le livret fait commencer le plus jeune : ici, le sort choisit.
        </p>
      </div>
    </Modal>
  );
}
