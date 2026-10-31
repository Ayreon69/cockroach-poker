// Salon : partage de la table, liste des joueurs, réglages de l'hôte et lancement.
import { motion } from 'framer-motion';
import { BookOpen, Bot, Check, Copy, Crown, LogOut, Play, QrCode, Share2, UserX } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS, THINK_OPTIONS, type RoomView, type ThinkTime } from '../../../shared/protocol';
import { Medallion } from '../components/Beasts';
import { Button, Cabinet, Logo, Modal, Pill, Segmented } from '../components/Ui';
import { cls, shareUrl } from '../lib/util';
import { leaveRoom, send } from '../net';
import { useStore } from '../store';

export function Lobby({ view }: { view: RoomView }) {
  const setRulesOpen = useStore((s) => s.setRulesOpen);
  const isHost = view.hostId === view.me;
  const seated = view.players.filter((p) => p.status !== 'spectator');
  const spectators = view.players.filter((p) => p.status === 'spectator');
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState(false);
  const url = shareUrl(view.code);
  const host = view.players.find((p) => p.id === view.hostId);
  const me = view.players.find((p) => p.id === view.me);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      useStore.getState().showToast(`Lien : ${url}`, 'info');
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Cockroach Poker', text: `Viens jouer au Cockroach Poker (table ${view.code}) !`, url });
      } catch {
        /* partage annulé */
      }
    } else void copy();
  };

  return (
    <Cabinet className="is-quiet">
      <div className="lobby">
        <header className="lobby-top">
          <Logo size="sm" />
          <Button variant="ghost" icon={<LogOut size={18} />} onClick={() => void leaveRoom()}>
            Quitter
          </Button>
        </header>

        <motion.section className="code-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <span className="eyebrow">Étiquette de la table</span>
          <div className="big-code" aria-label={`Code ${view.code.split('').join(' ')}`}>
            {view.code.split('').map((c, i) => (
              <span key={i} aria-hidden>
                {c}
              </span>
            ))}
          </div>
          <div className="share-row">
            <Button variant="primary" icon={<Share2 size={18} />} onClick={share}>
              Inviter des amis
            </Button>
            <Button icon={copied ? <Check size={18} /> : <Copy size={18} />} onClick={copy}>
              {copied ? 'Lien copié !' : 'Copier le lien'}
            </Button>
            <Button icon={<QrCode size={18} />} onClick={() => setQr(true)} aria-label="Afficher le QR code">
              QR
            </Button>
          </div>
        </motion.section>

        <div className="lobby-grid">
          <section className="sheet">
            <div className="sheet-head">
              <h3>
                Collectionneurs <span className="muted">{seated.length}/{MAX_PLAYERS}</span>
              </h3>
              {isHost && (
                <Button icon={<Bot size={18} />} disabled={seated.length >= MAX_PLAYERS} onClick={() => void send('room:addBot')}>
                  Ajouter un bot
                </Button>
              )}
            </div>
            <ul className="player-list">
              {seated.map((p) => (
                <li key={p.id} className={cls('player-row', p.id === view.me && 'is-me')}>
                  <Medallion avatar={p.avatar} size="sm" />
                  <span className="player-name">
                    {p.name}
                    {p.id === view.me && <span className="muted"> (toi)</span>}
                  </span>
                  {p.isHost && (
                    <Pill tone="brass">
                      <Crown size={12} /> Hôte
                    </Pill>
                  )}
                  {p.isBot && <Pill tone="green">Bot</Pill>}
                  {!p.connected && <Pill>Hors ligne</Pill>}
                  {isHost && p.id !== view.me && (
                    <button type="button" className="icon-btn" aria-label={`Retirer ${p.name}`} onClick={() => void send('room:kick', { playerId: p.id })}>
                      <UserX size={18} />
                    </button>
                  )}
                </li>
              ))}
              {Array.from({ length: Math.max(0, MIN_PLAYERS - seated.length) }, (_, i) => (
                <li key={`empty${i}`} className="player-row is-empty">
                  <span className="player-ghost">?</span>
                  <span className="player-name muted">En attente d'un joueur…</span>
                </li>
              ))}
            </ul>
            {spectators.length > 0 && <p className="muted small">Spectateurs : {spectators.map((p) => p.name).join(', ')}</p>}
            {me?.status === 'spectator' && <p className="muted small">La table est complète : tu regarderas la partie.</p>}
          </section>

          <section className="sheet">
            <div className="sheet-head">
              <h3>Réglages</h3>
              {!isHost && <span className="muted small">choisis par {host?.name ?? "l'hôte"}</span>}
            </div>
            <span className="field-label">Temps de réflexion</span>
            <Segmented<ThinkTime>
              label="Temps de réflexion"
              value={view.settings.think}
              disabled={!isHost}
              onChange={(think) => void send('room:settings', { think })}
              options={THINK_OPTIONS.map((t) => ({ value: t, label: t === 0 ? 'Sans limite' : `${t} s` }))}
            />
            <p className="muted small lobby-note">Le temps écoulé, le pilote automatique joue à ta place.</p>
            <div className={cls('duo-note', seated.length === 2 && 'is-on')}>
              <b>À deux :</b> dix cartes écartées, pas de passe, et l'on perd à cinq bestioles identiques.
            </div>
          </section>
        </div>

        <div className="lobby-cta">
          {isHost ? (
            <Button variant="primary" className="btn-lg btn-wide" icon={<Play size={20} />} disabled={seated.length < MIN_PLAYERS} onClick={() => void send('game:start')}>
              {seated.length < MIN_PLAYERS ? `Il faut au moins ${MIN_PLAYERS} joueurs` : `Lancer la partie (${seated.length} joueurs)`}
            </Button>
          ) : (
            <div className="waiting" role="status">
              <span className="spinner" /> En attente que {host?.name ?? "l'hôte"} lance la partie…
            </div>
          )}
          <Button variant="ghost" icon={<BookOpen size={18} />} onClick={() => setRulesOpen(true)}>
            Nouveau ? Les règles en 1 minute
          </Button>
        </div>

        <Modal open={qr} onClose={() => setQr(false)} title={`Table ${view.code}`}>
          <div className="qr-box">
            <QRCodeSVG value={url} size={220} bgColor="#f3e8cf" fgColor="#2a1d12" level="M" includeMargin />
            <p className="muted small">Scanne pour rejoindre la table directement.</p>
            <code className="url-code">{url}</code>
          </div>
        </Modal>
      </div>
    </Cabinet>
  );
}
