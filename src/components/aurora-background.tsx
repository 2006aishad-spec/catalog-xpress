type AuroraBackgroundProps = {
  className?: string;
  withParticles?: boolean;
};

export function AuroraBackground({
  className = "",
  withParticles = true,
}: AuroraBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={`aurora-background pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
    >
      <div className="grid-bg absolute inset-0" />
      <div className="aurora-orb aurora-orb-one" />
      <div className="aurora-orb aurora-orb-two" />
      <div className="aurora-orb aurora-orb-three" />
      <div className="aurora-orb aurora-orb-four" />

      {withParticles && (
        <div className="particle-field">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="particle"
              style={{
                left: `${(i * 5.7 + 3) % 100}%`,
                animationDuration: `${9 + (i % 7) * 1.4}s`,
                animationDelay: `${(i * 0.55) % 8}s`,
                width: i % 3 === 0 ? 4 : 2,
                height: i % 3 === 0 ? 4 : 2,
                opacity: 0.25 + (i % 5) * 0.08,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
