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
  const natural = variant === "full" ? { w: 593, h: 762 } : { w: 241, h: 437 };
  return (
    <img
      src={src}
      alt="Djumbai Shop"
      width={natural.w}
      height={natural.h}
      style={{ height, width: "auto", maxWidth: "100%", objectFit: "contain" }}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={className}
    />
  );
}

