import { useMemo, useState } from 'react';

type Props = {
  /** Tier 1 */
  imageUrl?: string | null;
  /** Tier 2 (must be provided by API or derived from category) */
  categoryPlaceholderUrl?: string | null;
  /** Used only for accessibility; visuals are decorative */
  alt?: string;
  /** Fixed sizing */
  size: 150 | 400;
  className?: string;
};

const GENERIC = '/placeholders/generic.png';

export function ProductImage(props: Props) {
  const [failCount, setFailCount] = useState(0);

  const src = useMemo(() => {
    if (failCount <= 0 && props.imageUrl) return props.imageUrl;
    if (failCount <= 1 && props.categoryPlaceholderUrl) return props.categoryPlaceholderUrl;
    return GENERIC;
  }, [failCount, props.imageUrl, props.categoryPlaceholderUrl]);

  const box = props.size === 400 ? 'h-[400px] w-[400px]' : 'h-[150px] w-[150px]';
  const cls = `${box} rounded-md border border-slate-200 bg-white object-cover ${props.className ?? ''}`.trim();

  return (
    <img
      src={src}
      alt={props.alt ?? ''}
      width={props.size}
      height={props.size}
      className={cls}
      loading="lazy"
      onError={() => setFailCount((n) => Math.min(2, n + 1))}
    />
  );
}

