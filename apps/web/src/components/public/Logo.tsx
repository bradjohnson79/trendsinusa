import { useState } from 'react';

/**
 * Branding logo.
 *
 * Prefer the new raster logo (added by user) if present, but fall back to the existing SVG
 * so the app doesn't break before the asset is committed.
 */
export function Logo(props: { className?: string }) {
  const [fallback, setFallback] = useState(false);
  return (
    <img
      src={fallback ? '/logo.svg' : '/logo.png'}
      alt="TrendsInUSA.com"
      className={props.className}
      onError={() => setFallback(true)}
    />
  );
}

