import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Reset window scroll when the route changes so pages always open at the top. */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
