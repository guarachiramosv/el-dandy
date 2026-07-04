type BrandLogoProps = {
  compact?: boolean;
  className?: string;
  imageClassName?: string;
};

export default function BrandLogo({ compact = false, className = "", imageClassName = "" }: BrandLogoProps) {
  return (
    <div className={`flex items-center ${className}`}>
      <img
        src={compact ? "/brand-mark.svg" : "/logo-diesel-dandy.svg"}
        alt="Diesel Dandy"
        className={imageClassName}
        draggable={false}
      />
    </div>
  );
}
