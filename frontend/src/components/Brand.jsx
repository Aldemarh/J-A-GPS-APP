// Logo y nombre de la marca, iguales a los de la landing.
export function Logo({ className = 'size-6' }) {
  return (
    <svg viewBox="0 0 30 30" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect width="30" height="30" rx="8" fill="#4c8dff" />
      <path d="M8 15.2L22 8l-7.2 14-1.5-5.3z" fill="#fff" />
    </svg>
  );
}

export default function Brand({ size = 'sm' }) {
  const large = size === 'lg';
  return (
    <span
      className={`flex items-center gap-2.5 font-semibold tracking-tight whitespace-nowrap text-fg ${
        large ? 'text-lg' : 'text-[15px]'
      }`}
    >
      <Logo className={large ? 'size-8' : 'size-6'} />
      <span>
        J&amp;A <span className="font-normal text-mute">Tech</span>
      </span>
    </span>
  );
}
