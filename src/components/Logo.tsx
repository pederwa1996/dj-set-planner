/** Appens merke: en vinylplate (LP) sett ovenfra — riller, lysrefleks og etikett i aksentfargen */
export function Logo({ size = 22, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={spin ? 'motion-safe:animate-[spin_2.4s_linear_infinite]' : undefined}>
      <circle cx="16" cy="16" r="15.2" fill="#0b0a09" stroke="#3b3835" strokeWidth="0.8" />
      {[13.4, 12.1, 10.8, 9.5, 8.2].map((r) => (
        <circle key={r} cx="16" cy="16" r={r} fill="none" stroke="#2f2b28" strokeWidth="0.45" />
      ))}
      {/* lysrefleks på vinylen */}
      <path d="M6.6 9.4 A11.5 11.5 0 0 1 11.2 5.5" fill="none" stroke="#f3efe7" strokeOpacity="0.32" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M25.4 22.6 A11.5 11.5 0 0 1 20.8 26.5" fill="none" stroke="#f3efe7" strokeOpacity="0.18" strokeWidth="1.5" strokeLinecap="round" />
      {/* etikett */}
      <circle cx="16" cy="16" r="6.2" fill="#ef6a3a" />
      <circle cx="16" cy="16" r="4.3" fill="none" stroke="#0e0d0c" strokeOpacity="0.28" strokeWidth="0.6" />
      <circle cx="16" cy="16" r="1.05" fill="#0e0d0c" />
    </svg>
  );
}
