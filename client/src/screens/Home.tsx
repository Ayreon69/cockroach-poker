// Accueil : la planche de titre, trois spécimens, pseudo + médaillon, ouvrir / rejoindre une table, entraînement, règles.
import { motion } from 'framer-motion';
import { BookOpen, Bot, House, MessageSquare, LogIn, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AVATARS } from '../../../shared/protocol';
import { AVATAR_LABELS, CardBack, CardFace, Medallion } from '../components/Beasts';
import { Button, Cabinet, Logo, Scuttler } from '../components/Ui';
import { cls } from '../lib/util';
import { codeFromUrl, createRoom, joinRoom } from '../net';
import { useStore } from '../store';

export function Home() {
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const setRulesOpen = useStore((s) => s.setRulesOpen);
  const conn = useStore((s) => s.conn);
  const [invited, setInvited] = useState(codeFromUrl);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => setInvited(codeFromUrl());
    window.addEventListener('cr:url', sync);
    return () => window.removeEventListener('cr:url', sync);
  }, []);
  const nameOk = profile.name.trim().length > 0;

  const run = async (key: string, fn: () => Promise<boolean>) => {
    if (busy) return;
    if (!nameOk) {
      useStore.getState().showToast("Écris d'abord ton nom sur l'étiquette.", 'info');
      document.getElementById('pseudo')?.focus();
      return;
    }
    setBusy(key);
    await fn();
    setBusy(null);
  };

  const cleanCode = code.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4);

  return (
    <Cabinet className="home">
      <div className="home-links">
        <a className="all-games" href="https://akhis-games.onrender.com">
          <House size={16} aria-hidden /> Tous les jeux
        </a>
        <a className="all-games" href="https://akhis-games.onrender.com/feedback.html?jeu=cockroach">
          <MessageSquare size={16} aria-hidden /> Feedback
        </a>
      </div>
      <Scuttler />
      <header className="home-hero">
        <p className="home-eyebrow">Cabinet de curiosités · planches I à VIII</p>
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Logo size="lg" />
        </motion.div>
        <p className="tagline">Glisse une bestiole, annonce n'importe quoi, et regarde-les douter.</p>
        <div className="hero-cards" aria-hidden>
          <motion.span className="hero-card is-left" initial={{ opacity: 0, rotate: 0, y: 30 }} animate={{ opacity: 1, rotate: -14, y: 8 }} transition={{ delay: 0.15, type: 'spring', stiffness: 140, damping: 16 }}>
            <CardFace animal="crapaud" size="md" />
          </motion.span>
          <motion.span className="hero-card is-mid" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, type: 'spring', stiffness: 140, damping: 16 }}>
            <CardBack size="md" />
            <span className="hero-claim">« C'est un cafard ! »</span>
          </motion.span>
          <motion.span className="hero-card is-right" initial={{ opacity: 0, rotate: 0, y: 30 }} animate={{ opacity: 1, rotate: 13, y: 8 }} transition={{ delay: 0.45, type: 'spring', stiffness: 140, damping: 16 }}>
            <CardFace animal="scorpion" size="md" />
          </motion.span>
        </div>
      </header>

      <motion.section className="sheet home-panel" initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.45 }}>
        {invited && (
          <div className="invite-banner">
            Invitation à la table <b>{invited}</b> : écris ton nom et entre !
          </div>
        )}
        <label className="field-label" htmlFor="pseudo">
          Ton nom de collectionneur
        </label>
        <input
          id="pseudo"
          className="input input-lg"
          placeholder="Ex. Professeur Blatte"
          value={profile.name}
          maxLength={16}
          autoComplete="nickname"
          onChange={(e) => setProfile({ name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && invited) void run('join', () => joinRoom(invited));
          }}
        />
        <span className="field-label" id="avatar-label">
          Ton médaillon
        </span>
        <div className="avatar-picker" role="radiogroup" aria-labelledby="avatar-label">
          {AVATARS.map((a) => (
            <button key={a} type="button" role="radio" aria-checked={profile.avatar === a} aria-label={AVATAR_LABELS[a]} className={cls('avatar-opt', profile.avatar === a && 'is-on')} onClick={() => setProfile({ avatar: a })}>
              <Medallion avatar={a} size="sm" />
            </button>
          ))}
        </div>

        {invited ? (
          <div className="home-actions">
            <Button variant="primary" className="btn-lg" icon={<LogIn size={20} />} disabled={!!busy} onClick={() => run('join', () => joinRoom(invited))}>
              {busy === 'join' ? 'Connexion…' : `Rejoindre la table ${invited}`}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                window.history.replaceState(null, '', '/');
                setInvited(null);
              }}
            >
              Ouvrir ma propre table à la place
            </Button>
          </div>
        ) : (
          <div className="home-actions">
            <Button variant="primary" className="btn-lg" icon={<Plus size={20} />} disabled={!!busy} onClick={() => run('create', () => createRoom())}>
              {busy === 'create' ? 'Ouverture…' : 'Ouvrir une table'}
            </Button>
            <div className="join-row">
              <input
                className="input code-input"
                placeholder="CODE"
                value={cleanCode}
                maxLength={4}
                aria-label="Code de la table"
                autoCapitalize="characters"
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && cleanCode.length === 4) void run('join', () => joinRoom(cleanCode));
                }}
              />
              <Button icon={<LogIn size={18} />} disabled={cleanCode.length !== 4 || !!busy} onClick={() => run('join', () => joinRoom(cleanCode))}>
                Rejoindre
              </Button>
            </div>
            <Button icon={<Bot size={18} />} disabled={!!busy} onClick={() => run('bots', () => createRoom({ bots: 3, autostart: true }))}>
              {busy === 'bots' ? 'Préparation…' : "S'entraîner contre 3 bots"}
            </Button>
          </div>
        )}
        <Button variant="ghost" className="rules-link" icon={<BookOpen size={18} />} onClick={() => setRulesOpen(true)}>
          Les règles en 1 minute
        </Button>
        {conn !== 'online' && (
          <p className="wake-note" role="status">
            <span className="spinner" /> Réveil du serveur… (jusqu'à une minute la première fois)
          </p>
        )}
      </motion.section>

      <footer className="home-foot">
        D'après <i>Cockroach Poker</i>, de Jacques Zeimet. Création de fans, non officielle.
      </footer>
    </Cabinet>
  );
}
