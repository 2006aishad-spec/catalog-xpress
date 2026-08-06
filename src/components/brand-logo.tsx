import logoFull from "@/assets/djumbai-logo.png";
import logoMark from "@/assets/djumbai-mark.png";

type Props = {
  /** "full" = marca completa (ícone + nome + slogan). "mark" = só o ícone. */
  variant?: "full" | "mark";
  /** Altura em px do logo. */
  height?: number;
  className?: string;
  priority?: boolean;
};

/**
 * Logo oficial Djumbai Shop.
 * Usa sempre os ficheiros oficiais fornecidos — não substituir por ícones genéricos.
 */
export function BrandLogo({ variant = "full", height = 36, className, priority }: Props) {
  const src = variant === "full" ? logoFull : logoMark;
  const ratio = variant === "full" ? 593 / 762 : 241 / 437;
  return (
    <img
      src={src}
      alt="Djumbai Shop"
      height={height}
      width={Math.round(height * ratio)}
      style={{ height, width: "auto" }}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={className}
    />
  );
}
