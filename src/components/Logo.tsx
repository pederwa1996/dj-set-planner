/** Appens merke: en stilisert plate med en vinylrille (egen tegning) */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="#d97757" />
      <circle cx="16" cy="16" r="9.5" fill="none" stroke="#1f1e1d" strokeWidth="1.4" opacity=".55" />
      <circle cx="16" cy="16" r="5.5" fill="none" stroke="#1f1e1d" strokeWidth="1.4" opacity=".55" />
      <circle cx="16" cy="16" r="2.2" fill="#1f1e1d" />
    </svg>
  );
}
