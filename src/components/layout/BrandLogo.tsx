import Image from "next/image";

export type BrandLogoVariant = "wordmark" | "emblem";

type BrandLogoProps = {
  variant: BrandLogoVariant;
  /** Wrapper classes — image keeps intrinsic aspect ratio via fixed heights below. */
  className?: string;
  priority?: boolean;
};

/**
 * ONE X CLUB brand marks live under `/public/brand/` (see `globals.css` for palette notes).
 * Reuse this component on marketing/auth screens so logo paths stay centralized for redesigns.
 */
export function BrandLogo({ variant, className = "", priority }: BrandLogoProps) {
  const src = variant === "wordmark" ? "/brand/logo-wordmark.png" : "/brand/logo-emblem.png";
  const alt = "ONE X CLUB";

  if (variant === "wordmark") {
    return (
      <div className={`relative h-14 w-52 sm:h-16 sm:w-60 ${className}`}>
        <Image src={src} alt={alt} fill priority={priority} className="object-contain object-left drop-shadow-lg" sizes="240px" />
      </div>
    );
  }

  return (
    <div className={`relative size-24 sm:size-28 ${className}`}>
      <Image src={src} alt={alt} fill priority={priority} className="object-contain drop-shadow-lg" sizes="112px" />
    </div>
  );
}
