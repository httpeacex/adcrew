import type { ImgHTMLAttributes } from 'react';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string; fill?: boolean; unoptimized?: boolean; priority?: boolean };
export default function Image({ src, fill, unoptimized: _unoptimized, priority, style, alt = '', ...props }: Props) {
  void _unoptimized;
  const base = import.meta.env.BASE_URL;
  // Plain images are intentional in this static build; no Next.js image server is needed.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={alt} src={src.startsWith('/') ? `${base}${src.slice(1)}` : src} loading={priority ? 'eager' : props.loading} style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...style } : style} />;
}
