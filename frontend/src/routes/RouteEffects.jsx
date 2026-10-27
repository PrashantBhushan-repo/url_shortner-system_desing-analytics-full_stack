import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { routeTitle } from './navigation';

export default function RouteEffects() {
  const { pathname, search, hash, key } = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map());
  const previousPath = useRef(null);
  useEffect(() => { document.title = routeTitle(pathname, search); }, [pathname, search]);
  useEffect(() => {
    const hadPreviousPage = previousPath.current !== null;
    const changedPage = previousPath.current !== pathname;
    previousPath.current = pathname;
    const restore = navigationType === 'POP' && hadPreviousPage ? positions.current.get(key) || { x: 0, y: 0 } : null;
    let finished = false;
    function place() {
      if (finished) return;
      if (hash) {
        let id; try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
        const target = document.getElementById(id);
        if (!target) return;
        target.scrollIntoView({ block: 'start', behavior: 'instant' }); finished = true;
      } else {
        if (restore) {
          window.scrollTo({ left: restore.x, top: restore.y, behavior: 'instant' });
          // Wait for lazy content/data before declaring scroll restoration done.
          if (document.documentElement.scrollHeight - innerHeight < restore.y) return;
        } else if (changedPage && navigationType !== 'POP') window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        const heading = document.querySelector('main h1, [data-route-heading]');
        if (!heading) return;
        if (changedPage && pathname !== '/auth') { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
        finished = true;
      }
    }
    const observer = new MutationObserver(place);
    observer.observe(document.body, { childList: true, subtree: true });
    const frame = requestAnimationFrame(place);
    const timer = setTimeout(() => observer.disconnect(), 3000);
    const record = () => { positions.current.set(key, { x: window.scrollX, y: window.scrollY }); if (positions.current.size > 80) positions.current.delete(positions.current.keys().next().value); };
    window.addEventListener('scroll', record, { passive: true });
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); observer.disconnect(); window.removeEventListener('scroll', record); };
  }, [pathname, hash, key, navigationType]);
  return null;
}
