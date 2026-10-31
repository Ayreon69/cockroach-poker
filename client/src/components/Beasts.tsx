// Les huit bestioles du cabinet, gravées à la main en SVG, et tout ce qui les montre : cartes, dos, piles, médaillons.
import type { CSSProperties, ReactNode } from 'react';
import { ANIMALS, type Animal, type Piles } from '../../../shared/protocol';
import { cls } from '../lib/util';

export interface Beast {
  name: string;
  plural: string;
  /** « un crapaud », « une mouche » */
  un: string;
  /** « le crapaud », « l'araignée » */
  le: string;
  latin: string;
  plate: string;
  color: string;
}

export const BEASTS: Record<Animal, Beast> = {
  cafard: { name: 'Cafard', plural: 'cafards', un: 'un cafard', le: 'le cafard', latin: 'Blatta mendax', plate: 'I', color: '#9a5a2a' },
  chauvesouris: { name: 'Chauve-souris', plural: 'chauves-souris', un: 'une chauve-souris', le: 'la chauve-souris', latin: 'Vespertilio fabulator', plate: 'II', color: '#6b4f98' },
  mouche: { name: 'Mouche', plural: 'mouches', un: 'une mouche', le: 'la mouche', latin: 'Musca bluffatrix', plate: 'III', color: '#1f7d8e' },
  crapaud: { name: 'Crapaud', plural: 'crapauds', un: 'un crapaud', le: 'le crapaud', latin: 'Bufo impassibilis', plate: 'IV', color: '#5c8a2a' },
  rat: { name: 'Rat', plural: 'rats', un: 'un rat', le: 'le rat', latin: 'Rattus perfidus', plate: 'V', color: '#6e7684' },
  scorpion: { name: 'Scorpion', plural: 'scorpions', un: 'un scorpion', le: 'le scorpion', latin: 'Scorpio fallax', plate: 'VI', color: '#cc5b26' },
  araignee: { name: 'Araignée', plural: 'araignées', un: 'une araignée', le: "l'araignée", latin: 'Aranea dolosa', plate: 'VII', color: '#323a63' },
  punaise: { name: 'Punaise', plural: 'punaises', un: 'une punaise', le: 'la punaise', latin: 'Pentatoma foetida', plate: 'VIII', color: '#c3901a' },
};

export function beastVars(animal: Animal): CSSProperties {
  return { '--c': BEASTS[animal].color } as CSSProperties;
}

/** Espace insécable : en français, la ponctuation haute et les guillemets ne se retrouvent jamais seuls en début de ligne. */
const NB = ' ';

/** « C'est un crapaud ! » */
export function claimText(animal: Animal): string {
  return `C'est ${BEASTS[animal].un}${NB}!`;
}

/** Met une parole entre guillemets français, sans qu'ils puissent se détacher. */
export function quote(text: string): string {
  return `«${NB}${text}${NB}»`;
}

const EYE = '#fff8e6';

/** Les traits de gravure : contour à l'encre, hachures fines, aplats lavés à l'aquarelle. */
function Engraving({ children }: { children: ReactNode }) {
  return (
    <g fill="none" stroke="var(--ink)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </g>
  );
}

function Hatch({ children }: { children: ReactNode }) {
  return (
    <g strokeWidth={0.9} opacity={0.55}>
      {children}
    </g>
  );
}

const DRAWINGS: Record<Animal, ReactNode> = {
  cafard: (
    <Engraving>
      <path d="M46 20 C40 10 30 5 14 7" />
      <path d="M54 20 C60 10 70 5 86 7" />
      <path d="M38 44 L26 38 L17 42" />
      <path d="M36 58 L20 60 L12 70" />
      <path d="M38 72 L26 82 L22 94" />
      <path d="M62 44 L74 38 L83 42" />
      <path d="M64 58 L80 60 L88 70" />
      <path d="M62 72 L74 82 L78 94" />
      <path d="M50 37 C67 39 71 64 62 84 Q50 97 38 84 C29 64 33 39 50 37 Z" fill="var(--c)" />
      <path d="M50 40 L50 92" />
      <Hatch>
        <path d="M42 50 C40 60 40 70 43 80" />
        <path d="M58 50 C60 60 60 70 57 80" />
        <path d="M46 47 C45 58 45 70 47 86" />
        <path d="M54 47 C55 58 55 70 53 86" />
      </Hatch>
      <path d="M42 48 C40.5 56 40.5 63 42 69" stroke="#fff" strokeWidth={2.4} opacity={0.45} />
      <ellipse cx="50" cy="30" rx="15" ry="9" fill="var(--c-soft)" />
      <Hatch>
        <path d="M40 30 Q50 25 60 30" />
      </Hatch>
      <ellipse cx="50" cy="20.5" rx="7.5" ry="5.5" fill="var(--c-deep)" />
      <circle cx="46.6" cy="19.6" r="1.9" fill={EYE} stroke="none" />
      <circle cx="53.4" cy="19.6" r="1.9" fill={EYE} stroke="none" />
      <circle cx="47.3" cy="20" r="0.9" fill="var(--ink)" stroke="none" />
      <circle cx="54.1" cy="20" r="0.9" fill="var(--ink)" stroke="none" />
    </Engraving>
  ),
  chauvesouris: (
    <Engraving>
      <path d="M44 44 C34 34 18 30 4 36 C9 41 10 47 8 54 C14 51 20 52 23 58 C27 53 33 53 38 58 C40 54 42 52 45 52 Z" fill="var(--c)" />
      <path d="M56 44 C66 34 82 30 96 36 C91 41 90 47 92 54 C86 51 80 52 77 58 C73 53 67 53 62 58 C60 54 58 52 55 52 Z" fill="var(--c)" />
      <Hatch>
        <path d="M44 44 L8 54" />
        <path d="M44 46 L23 58" />
        <path d="M44 48 L38 58" />
        <path d="M44 42 L12 37" />
        <path d="M56 44 L92 54" />
        <path d="M56 46 L77 58" />
        <path d="M56 48 L62 58" />
        <path d="M56 42 L88 37" />
      </Hatch>
      <path d="M46 67 L44.5 73 M54 67 L55.5 73" />
      <ellipse cx="50" cy="54" rx="9" ry="14" fill="var(--c-deep)" />
      <Hatch>
        <path d="M46 50 L45 60 M50 49 L50 62 M54 50 L55 60" />
      </Hatch>
      <path d="M43.5 33 L41 21 L48 29 Z" fill="var(--c-deep)" />
      <path d="M56.5 33 L59 21 L52 29 Z" fill="var(--c-deep)" />
      <circle cx="50" cy="36" r="8.5" fill="var(--c-deep)" />
      <circle cx="46.3" cy="34.8" r="2.8" fill={EYE} strokeWidth={1.2} />
      <circle cx="53.7" cy="34.8" r="2.8" fill={EYE} strokeWidth={1.2} />
      <circle cx="47" cy="35.6" r="1.3" fill="var(--ink)" stroke="none" />
      <circle cx="54.4" cy="35.6" r="1.3" fill="var(--ink)" stroke="none" />
      <path d="M47.4 40.4 L48.4 43.6 L49.4 40.4 Z M50.6 40.4 L51.6 43.6 L52.6 40.4 Z" fill="#fff" strokeWidth={0.9} />
    </Engraving>
  ),
  mouche: (
    <Engraving>
      <path d="M42 46 L28 41 L21 47" />
      <path d="M42 52 L26 58 L21 66" />
      <path d="M44 58 L34 70 L32 80" />
      <path d="M58 46 L72 41 L79 47" />
      <path d="M58 52 L74 58 L79 66" />
      <path d="M56 58 L66 70 L68 80" />
      <ellipse cx="50" cy="68" rx="9.5" ry="15" fill="var(--c)" />
      <path d="M41.5 63 Q50 66.5 58.5 63" />
      <path d="M41 71 Q50 74.5 59 71" />
      <path d="M43 78.5 Q50 81.5 57 78.5" />
      <ellipse cx="32" cy="60" rx="21" ry="9" transform="rotate(-38 32 60)" fill="#eef6f3" fillOpacity={0.72} strokeWidth={1.6} />
      <ellipse cx="68" cy="60" rx="21" ry="9" transform="rotate(38 68 60)" fill="#eef6f3" fillOpacity={0.72} strokeWidth={1.6} />
      <Hatch>
        <path d="M44 50 C36 58 28 65 19 72" />
        <path d="M43 53 C37 61 31 67 25 74" />
        <path d="M56 50 C64 58 72 65 81 72" />
        <path d="M57 53 C63 61 69 67 75 74" />
      </Hatch>
      <ellipse cx="50" cy="47" rx="10.5" ry="9" fill="var(--c-deep)" />
      <Hatch>
        <path d="M44 44 Q50 41 56 44 M43 49 Q50 46 57 49" />
      </Hatch>
      <ellipse cx="50" cy="33" rx="12" ry="7" fill="var(--c-soft)" />
      <circle cx="42" cy="30" r="7.5" fill="#8e2a1c" />
      <circle cx="58" cy="30" r="7.5" fill="#8e2a1c" />
      <g fill="#d46a4f" stroke="none" opacity={0.75}>
        <circle cx="40" cy="31" r="0.9" />
        <circle cx="43" cy="33" r="0.9" />
        <circle cx="44.5" cy="29.5" r="0.9" />
        <circle cx="41" cy="34.5" r="0.9" />
        <circle cx="56" cy="33" r="0.9" />
        <circle cx="59" cy="31" r="0.9" />
        <circle cx="60" cy="34.5" r="0.9" />
        <circle cx="55.5" cy="29.5" r="0.9" />
      </g>
      <circle cx="39.6" cy="27.4" r="2" fill="#fff" stroke="none" opacity={0.85} />
      <circle cx="55.6" cy="27.4" r="2" fill="#fff" stroke="none" opacity={0.85} />
    </Engraving>
  ),
  crapaud: (
    <Engraving>
      <path d="M25 68 C10 68 7 86 19 89 L35 89" fill="var(--c)" />
      <path d="M75 68 C90 68 93 86 81 89 L65 89" fill="var(--c)" />
      <path d="M22 65 C20 46 34 37 50 37 C66 37 80 46 78 65 C77 80 64 88 50 88 C36 88 23 80 22 65 Z" fill="var(--c)" />
      <ellipse cx="50" cy="75" rx="16" ry="9" fill="var(--c-soft)" />
      <Hatch>
        <path d="M38 75 Q50 79 62 75 M40 80 Q50 83 60 80" />
        <path d="M26 64 C27 72 31 78 36 82 M74 64 C73 72 69 78 64 82" />
      </Hatch>
      <g fill="var(--c-deep)" stroke="none">
        <circle cx="30" cy="49" r="1.9" />
        <circle cx="69" cy="48" r="2.1" />
        <circle cx="26" cy="59" r="1.5" />
        <circle cx="74" cy="58" r="1.6" />
        <circle cx="44" cy="47" r="1.3" />
        <circle cx="57" cy="46" r="1.4" />
        <circle cx="34" cy="66" r="1.3" />
        <circle cx="66" cy="67" r="1.5" />
      </g>
      <circle cx="37" cy="39" r="9.5" fill="var(--c)" />
      <circle cx="63" cy="39" r="9.5" fill="var(--c)" />
      <circle cx="37" cy="39.5" r="5.8" fill="#e8c14a" strokeWidth={1.4} />
      <circle cx="63" cy="39.5" r="5.8" fill="#e8c14a" strokeWidth={1.4} />
      <rect x="33" y="39.6" width="8" height="2.3" rx="1.15" fill="var(--ink)" stroke="none" />
      <rect x="59" y="39.6" width="8" height="2.3" rx="1.15" fill="var(--ink)" stroke="none" />
      {/* Paupières lourdes : le crapaud a la tête du joueur de poker qui ne dira rien. */}
      <path d="M30.6 40 C31 33 43 33 43.4 40 Z" fill="var(--c-deep)" strokeWidth={1.6} />
      <path d="M56.6 40 C57 33 69 33 69.4 40 Z" fill="var(--c-deep)" strokeWidth={1.6} />
      <path d="M29 56 C39 62 61 62 71 56" />
      <path d="M36 80 L32 92 M32 92 L27 94 M32 92 L31 96.5 M32 92 L36.5 95" />
      <path d="M64 80 L68 92 M68 92 L73 94 M68 92 L69 96.5 M68 92 L63.5 95" />
    </Engraving>
  ),
  rat: (
    <Engraving>
      <path d="M78 70 C92 72 96 86 86 91 C76 95 64 90 55 94" stroke="#a8796c" strokeWidth={2.6} />
      <path d="M40 76 L38 86 L33 87.5" />
      <path d="M70 76 L72 86 L67 87.5" />
      <path d="M28 60 C28 44 46 36 62 40 C78 44 86 56 82 68 C78 78 62 80 44 78 C34 77 28 70 28 60 Z" fill="var(--c)" />
      <Hatch>
        <path d="M50 44 C56 42 64 43 70 46" />
        <path d="M46 50 C54 47 66 48 74 53" />
        <path d="M60 72 C66 72 72 70 77 66" />
        <path d="M44 72 C50 74 56 74 62 74" />
      </Hatch>
      <path d="M40 49 C31 45 18 50 8 60 C16 66 28 69 40 66 Z" fill="var(--c)" />
      <path d="M8 60 C16 63 26 64 36 62" strokeWidth={1.1} opacity={0.6} />
      <circle cx="36" cy="46" r="7.5" fill="var(--c-soft)" />
      <circle cx="36" cy="46" r="4.2" fill="#d99a8f" stroke="none" />
      <circle cx="24" cy="56" r="2.4" fill="var(--ink)" stroke="none" />
      <circle cx="23.2" cy="55.2" r="0.8" fill="#fff" stroke="none" />
      {/* Un sourcil en coin : il prépare un sale coup. */}
      <path d="M19.5 51.5 L28 53" strokeWidth={1.7} />
      <circle cx="8.5" cy="60" r="2.2" fill="#d77b73" strokeWidth={1.3} />
      <Hatch>
        <path d="M12 60 L1 55 M12 61 L0.5 61.5 M12 62.5 L2 68" />
      </Hatch>
    </Engraving>
  ),
  scorpion: (
    <Engraving>
      <path d="M42 48 L30 44 L24 48" />
      <path d="M42 54 L28 54 L22 60" />
      <path d="M42 60 L30 64 L26 72" />
      <path d="M44 66 L34 74 L32 82" />
      <path d="M58 48 L70 44 L76 48" />
      <path d="M58 54 L72 54 L78 60" />
      <path d="M58 60 L70 64 L74 72" />
      <path d="M56 66 L66 74 L68 82" />
      <path d="M45 41 L36 32 L31 27" strokeWidth={3.2} />
      <path d="M55 41 L64 32 L69 27" strokeWidth={3.2} />
      <path d="M32 28 C21 28 14 20 18 11 C22 16 26 18 30 18 C26 14 26 10 28 7 C35 11 37 20 33 27 Z" fill="var(--c)" />
      <path d="M68 28 C79 28 86 20 82 11 C78 16 74 18 70 18 C74 14 74 10 72 7 C65 11 63 20 67 27 Z" fill="var(--c)" />
      <circle cx="75" cy="83" r="4.2" fill="var(--c)" />
      <circle cx="69" cy="90.5" r="4.4" fill="var(--c)" />
      <circle cx="60" cy="93" r="4.6" fill="var(--c)" />
      <circle cx="52.5" cy="88" r="4.8" fill="var(--c)" />
      <circle cx="50" cy="80" r="5" fill="var(--c)" />
      <path d="M50 38 C60 38 62 50 60 62 C58 72 54 76 50 76 C46 76 42 72 40 62 C38 50 40 38 50 38 Z" fill="var(--c)" />
      <path d="M41 50 Q50 53 59 50" />
      <path d="M41 58 Q50 61 59 58" />
      <path d="M42.5 66 Q50 69 57.5 66" />
      <Hatch>
        <path d="M45 42 L44 48 M55 42 L56 48 M46 70 L47 74 M54 70 L53 74" />
      </Hatch>
      <circle cx="78" cy="73" r="5.2" fill="var(--c-soft)" />
      <path d="M81 69 C83 62 78 58 71.5 61" strokeWidth={2.4} />
      <circle cx="47" cy="42.5" r="1.5" fill="var(--ink)" stroke="none" />
      <circle cx="53" cy="42.5" r="1.5" fill="var(--ink)" stroke="none" />
    </Engraving>
  ),
  araignee: (
    <Engraving>
      <path d="M50 0 L50 37" strokeWidth={1} />
      <path d="M45 40 C38 30 30 26 22 28 L12 38" />
      <path d="M44 44 C34 40 24 40 16 46 L8 58" />
      <path d="M44 48 C34 50 26 56 22 64 L16 76" />
      <path d="M46 52 C40 58 36 66 34 76 L32 88" />
      <path d="M55 40 C62 30 70 26 78 28 L88 38" />
      <path d="M56 44 C66 40 76 40 84 46 L92 58" />
      <path d="M56 48 C66 50 74 56 78 64 L84 76" />
      <path d="M54 52 C60 58 64 66 66 76 L68 88" />
      <ellipse cx="50" cy="65" rx="15.5" ry="17.5" fill="var(--c)" />
      <Hatch>
        <path d="M38 60 C38 70 42 78 48 81 M62 60 C62 70 58 78 52 81" />
      </Hatch>
      <path d="M50 55 L50 75 M43 63 L57 63" stroke="#f3e8cf" strokeWidth={2.2} />
      <ellipse cx="50" cy="44" rx="9.5" ry="8.5" fill="var(--c-deep)" />
      <g fill={EYE} stroke="none">
        <circle cx="46" cy="41" r="2.4" />
        <circle cx="54" cy="41" r="2.4" />
        <circle cx="42.5" cy="45" r="1.4" />
        <circle cx="57.5" cy="45" r="1.4" />
        <circle cx="47.6" cy="46.4" r="1.1" />
        <circle cx="52.4" cy="46.4" r="1.1" />
      </g>
      {/* Les deux grands yeux regardent ailleurs : elle a quelque chose à cacher. */}
      <circle cx="47.1" cy="41.6" r="1.15" fill="var(--ink)" stroke="none" />
      <circle cx="55.1" cy="41.6" r="1.15" fill="var(--ink)" stroke="none" />
    </Engraving>
  ),
  punaise: (
    <Engraving>
      <path d="M46 18 L40 10 L34 8 L27 2" />
      <path d="M54 18 L60 10 L66 8 L73 2" />
      <path d="M30 42 L18 38 L12 42" />
      <path d="M28 54 L14 56 L8 64" />
      <path d="M32 66 L22 76 L18 86" />
      <path d="M70 42 L82 38 L88 42" />
      <path d="M72 54 L86 56 L92 64" />
      <path d="M68 66 L78 76 L82 86" />
      {/* Ce qu'on appelle, poliment, son parfum. */}
      <g stroke="#7f9c3c" strokeWidth={1.7} opacity={0.9}>
        <path d="M41 87 C37 90 44 92 40 96" />
        <path d="M50 88 C46 91 53 93 49 97.5" />
        <path d="M59 87 C55 90 62 92 58 96" />
      </g>
      <path d="M50 22 L76 34 C80 54 70 74 50 84 C30 74 20 54 24 34 Z" fill="var(--c)" />
      <path d="M36 36 L64 36 L50 60 Z" fill="var(--c-soft)" />
      <path d="M33 66 Q50 75 67 66" />
      <Hatch>
        <path d="M28 42 C27 52 30 62 36 70 M72 42 C73 52 70 62 64 70" />
        <path d="M42 40 L50 54 L58 40" />
      </Hatch>
      <g fill="var(--c-deep)" stroke="none">
        <circle cx="31" cy="50" r="1.3" />
        <circle cx="69" cy="50" r="1.3" />
        <circle cx="40" cy="70" r="1.2" />
        <circle cx="60" cy="70" r="1.2" />
        <circle cx="50" cy="76" r="1.2" />
      </g>
      <path d="M44 24 L46 16 L54 16 L56 24 Z" fill="var(--c-deep)" />
      <circle cx="45.4" cy="19" r="1.7" fill="var(--ink)" stroke="none" />
      <circle cx="54.6" cy="19" r="1.7" fill="var(--ink)" stroke="none" />
    </Engraving>
  ),
};

export function BeastArt({ animal, className, style }: { animal: Animal; className?: string; style?: CSSProperties }) {
  return (
    <svg className={cls('beast', className)} viewBox="0 0 100 100" style={{ ...beastVars(animal), ...style }} aria-hidden focusable="false">
      {DRAWINGS[animal]}
    </svg>
  );
}

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

/** Une planche du cabinet : le dessin sur son lavis, le numéro, le nom vulgaire et le nom savant. */
export function CardFace({ animal, size = 'md', className, style }: { animal: Animal; size?: CardSize; className?: string; style?: CSSProperties }) {
  const b = BEASTS[animal];
  return (
    <span className={cls('card', 'card-face', `card-${size}`, className)} style={{ ...beastVars(animal), ...style }} role="img" aria-label={b.name}>
      <span className="card-wash" aria-hidden />
      {(size === 'md' || size === 'lg') && (
        <span className="card-plate" aria-hidden>
          Pl. {b.plate}
        </span>
      )}
      <BeastArt animal={animal} className="card-beast" />
      {(size === 'md' || size === 'lg') && (
        <span className="card-name" aria-hidden>
          {b.name}
        </span>
      )}
      {size === 'lg' && (
        <span className="card-latin" aria-hidden>
          {b.latin}
        </span>
      )}
    </span>
  );
}

/** L'œil gravé au dos des cartes : ici, tout le monde regarde tout le monde. */
export function EyeGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 40" aria-hidden focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M4 20 C16 4 44 4 56 20 C44 36 16 36 4 20 Z" />
        <circle cx="30" cy="20" r="9" />
        <circle cx="30" cy="20" r="3.6" fill="currentColor" />
        <path d="M30 2 V-2 M14 7 L11 3 M46 7 L49 3" />
      </g>
    </svg>
  );
}

export function CardBack({ size = 'md', className, style }: { size?: CardSize; className?: string; style?: CSSProperties }) {
  return (
    <span className={cls('card', 'card-back', `card-${size}`, className)} style={style} role="img" aria-label="Carte face cachée">
      <span className="card-back-medal" aria-hidden>
        <EyeGlyph />
      </span>
    </span>
  );
}

/** Une carte qui se retourne : le dos, puis la planche. */
export function FlipCard({ animal, shown, size = 'lg', className }: { animal: Animal | null; shown: boolean; size?: CardSize; className?: string }) {
  return (
    <span className={cls('flip', `flip-${size}`, shown && animal && 'is-shown', className)}>
      <span className="flip-inner">
        <CardBack size={size} className="flip-back" />
        {animal && <CardFace animal={animal} size={size} className="flip-front" />}
      </span>
    </span>
  );
}

function pilesLabel(piles: Piles): string {
  const parts = ANIMALS.filter((a) => piles[a] > 0).map((a) => `${piles[a]} ${piles[a] > 1 ? BEASTS[a].plural : BEASTS[a].name.toLowerCase()}`);
  return parts.length ? `Face visible : ${parts.join(', ')}` : 'Aucune carte face visible';
}

/**
 * Les cartes face visible devant un joueur, en piles par bestiole, comme sur une vraie table :
 * on compte les tranches des yeux, sans chiffre ni alerte.
 */
export function PileRow({ piles, size = 'xs', className, empty = 'Collection vide' }: { piles: Piles; size?: 'xs' | 'sm'; className?: string; empty?: string }) {
  const present = ANIMALS.filter((a) => piles[a] > 0);
  return (
    <span className={cls('piles', `piles-${size}`, className)} role="img" aria-label={pilesLabel(piles)}>
      {present.length === 0 ? (
        <span className="piles-empty" aria-hidden>
          {empty}
        </span>
      ) : (
        present.map((a) => (
          <span key={a} className="pile" style={{ '--n': piles[a] } as CSSProperties}>
            {Array.from({ length: piles[a] }, (_, i) => (
              <CardFace key={i} animal={a} size={size} className="pile-card" style={{ '--i': i } as CSSProperties} />
            ))}
          </span>
        ))
      )}
    </span>
  );
}

export const AVATAR_EMOJI: Record<string, string> = {
  hibou: '🦉',
  escargot: '🐌',
  papillon: '🦋',
  coccinelle: '🐞',
  herisson: '🦔',
  tortue: '🐢',
  pieuvre: '🐙',
  lezard: '🦎',
  abeille: '🐝',
  champignon: '🍄',
  coquillage: '🐚',
  crabe: '🦀',
};

export const AVATAR_LABELS: Record<string, string> = {
  hibou: 'Hibou',
  escargot: 'Escargot',
  papillon: 'Papillon',
  coccinelle: 'Coccinelle',
  herisson: 'Hérisson',
  tortue: 'Tortue',
  pieuvre: 'Pieuvre',
  lezard: 'Lézard',
  abeille: 'Abeille',
  champignon: 'Champignon',
  coquillage: 'Coquillage',
  crabe: 'Crabe',
};

/** Le portrait de chaque joueur, dans un médaillon de laiton comme ceux des collectionneurs. */
export function Medallion({ avatar, size = 'md', className }: { avatar: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span className={cls('medal', `medal-${size}`, className)} aria-hidden>
      <span className="medal-face">{AVATAR_EMOJI[avatar] ?? '🦉'}</span>
    </span>
  );
}
