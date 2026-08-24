type AuroraBackgroundProps = {
  className?: string;
};

export function AuroraBackground({ className = "" }: AuroraBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={`aurora-background pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
    >
      <div className="aurora-orb aurora-orb-one" />
      <div className="aurora-orb aurora-orb-two" />
      <div className="aurora-orb aurora-orb-three" />
    </div>
  );
}
