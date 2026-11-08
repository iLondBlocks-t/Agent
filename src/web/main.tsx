import React from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from '@remotion/player';
import { SmallTraps } from '../remotion/Film.tsx';
import { TIMELINE, TOTAL_FRAMES } from '../story/timeline.ts';
import './styles.css';

const CHAPTERS = TIMELINE.map((b) => ({ id: b.id, title: b.title, from: b.from, len: b.length }));

function App() {
  const playerRef = React.useRef<any>(null);
  const [frame, setFrame] = React.useState(0);
  const [wide, setWide] = React.useState(false);

  const seek = (f: number) => {
    playerRef.current?.seekTo(Math.max(0, Math.min(TOTAL_FRAMES - 1, f)));
    setFrame(Math.max(0, Math.min(TOTAL_FRAMES - 1, f)));
  };

  const active = CHAPTERS.filter((c) => frame >= c.from).pop() ?? CHAPTERS[0];

  React.useEffect(() => {
    const id = setInterval(() => {
      const f = playerRef.current?.getCurrentFrame?.();
      if (typeof f === 'number') setFrame(f);
    }, 120);
    return () => clearInterval(id);
  }, []);
  const total = TOTAL_FRAMES / 30;

  return (
    <div className="app">
      <header>
        <div>
          <h1>
            SMALL TRAPS <span className="ep">ep. 01</span>
          </h1>
          <p className="sub">Why do you say yes when you want to say no?</p>
        </div>
        <div className="meta">
          <span>{total.toFixed(1)}s</span>
          <span>{TOTAL_FRAMES} frames</span>
          <span>{wide ? '1920×1080' : '1080×1920'}</span>
        </div>
      </header>

      <main>
        <div className={`stage ${wide ? 'wide' : ''}`}>
          <Player
            ref={playerRef}
            component={SmallTraps}
            durationInFrames={TOTAL_FRAMES}
            compositionWidth={1080}
            compositionHeight={1920}
            fps={30}
            style={{ width: '100%', height: '100%' }}
            controls
            loop
            acknowledgeRemotionLicense
          />
        </div>

        <aside>
          <div className="chapters">
            <h2>Scenes</h2>
            {CHAPTERS.map((c) => (
              <button
                key={c.id}
                className={c.id === active.id ? 'on' : ''}
                onClick={() => seek(c.from)}
              >
                <span>{c.title}</span>
                <em>{(c.from / 30).toFixed(1)}s</em>
              </button>
            ))}
          </div>

          <div className="info">
            <h2>Style kit</h2>
            <p>
              Vector stickman cast, mauve room, cream speech bubbles, warm window shaft — all drawn
              procedurally as SVG, so every colour, pose and camera move is code.
            </p>
            <div className="swatches">
              {['#F4633F', '#F6E5CE', '#5E3471', '#3B234C', '#E7C9A6', '#67B98D'].map((c) => (
                <span key={c} style={{ background: c }} title={c} />
              ))}
            </div>
            <label className="toggle">
              <input type="checkbox" checked={wide} onChange={(e) => setWide(e.target.checked)} />
              letterbox preview (16:9)
            </label>
            <p className="hint">
              <strong>Render:</strong> <code>npm run render</code> → 1080×1920 MP4 with narration ·{' '}
              <code>npm run studio</code> for the Remotion timeline.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
