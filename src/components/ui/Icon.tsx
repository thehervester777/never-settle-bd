type Name =
  | 'cart' | 'search' | 'account' | 'menu' | 'close' | 'arrow-right' | 'arrow-left' | 'arrow-up-right'
  | 'chevron-down' | 'plus' | 'minus' | 'filter' | 'truck' | 'return' | 'shield' | 'bolt' | 'star' | 'check' | 'phone';

const paths: Record<Name, React.ReactNode> = {
  cart: <><path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" /></>,
  menu: <path d="M3 7h18M3 12h18M3 17h12" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  'arrow-right': <path d="M4 12h16m-6-6 6 6-6 6" />,
  'arrow-left': <path d="M20 12H4m6 6-6-6 6-6" />,
  'arrow-up-right': <path d="M7 17 17 7M8 7h9v9" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  filter: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  truck: <><path d="M2 6h12v10H2zM14 10h4l4 4v2h-8z" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  return: <><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>,
  shield: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  star: <path d="m12 2 3 7h7l-5.5 4.5L18.5 21 12 16.8 5.5 21l2-7.5L2 9h7z" />,
  check: <path d="m5 12 5 5 9-10" />,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
};

export function Icon({ name, className = 'h-5 w-5' }: { name: Name; className?: string }) {
  const filled = name === 'star';
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth={1.5} aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}
