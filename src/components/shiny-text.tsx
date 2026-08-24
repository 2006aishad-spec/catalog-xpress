type ShinyTextProps = {
  children: React.ReactNode;
  className?: string;
};

export function ShinyText({ children, className = "" }: ShinyTextProps) {
  return (
    <span className={`shiny-text ${className}`}>
      <span className="relative z-10">{children}</span>
    </span>
  );
}
