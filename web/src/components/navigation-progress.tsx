import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import './app-loader.css';

/** Subtle top progress bar while the route changes. */
export function NavigationProgress() {
  const { pathname } = useLocation();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setActive(true);
    setProgress(18);

    const mid = window.setTimeout(() => setProgress(72), 120);
    const done = window.setTimeout(() => setProgress(100), 280);
    const hide = window.setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 520);

    return () => {
      window.clearTimeout(mid);
      window.clearTimeout(done);
      window.clearTimeout(hide);
    };
  }, [pathname]);

  return (
    <div className={`navigation-progress${active ? ' active' : ''}`} aria-hidden>
      <div
        className="navigation-progress-bar"
        style={{ transform: `scaleX(${progress / 100})` }}
      />
    </div>
  );
}
