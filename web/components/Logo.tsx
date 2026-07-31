/**
 * The mark from brand/brand-guide.html: two mirrored chevrons with a gap.
 * Blue chevron = the request (what you control). White = Gemini's reply.
 * Dot = the session. Below 20px the dot is dropped and the stroke thickens,
 * the only sanctioned change to the construction.
 */
export function LogoMark({ size = 26 }: { size?: number }) {
  const small = size < 20;
  const stroke = small ? 3.6 : 2.4;

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M14.4 4.6 4.6 16l9.8 11.4"
        stroke="#4F8CFF"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.6 4.6 27.4 16l-9.8 11.4"
        stroke="#FAFAFA"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {!small && <circle cx="16" cy="16" r="2.2" fill="#4F8CFF" />}
    </svg>
  );
}

export function Lockup({ href = "/" }: { href?: string }) {
  return (
    <a className="lockup" href={href} aria-label="Free Gemini API">
      <LogoMark size={26} />
      <span className="wm">
        <i>Free</i>Gemini
      </span>
      <span className="tag">API</span>
    </a>
  );
}
