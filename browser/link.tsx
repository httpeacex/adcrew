import type { AnchorHTMLAttributes, MouseEvent } from 'react';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; scroll?: boolean; prefetch?: boolean };
export function navigate(path: string) {
  if (location.hash === `#${path}`) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = path;
}
export default function Link({ href, scroll, prefetch: _prefetch, onClick, ...props }: Props) {
  void _prefetch;
  const internal = href.startsWith('/');
  function click(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || !internal || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target === '_blank') return;
    event.preventDefault();
    navigate(href);
    if (scroll !== false) window.scrollTo({ top: 0, behavior: 'instant' });
  }
  return <a {...props} href={internal ? `#${href}` : href} onClick={click} />;
}
