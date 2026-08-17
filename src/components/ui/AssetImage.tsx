import Image from "next/image";

interface AssetImageProps {
  src?: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
}

/**
 * 디자인 교체를 전제로 한 이미지 컴포넌트.
 * - src가 있으면 next/image로 렌더.
 * - src가 null/미정이면 같은 크기의 "플레이스홀더 박스"로 대체(레이아웃 안 깨짐).
 * → 디자인/이미지가 나오기 전에도 화면 구조를 그대로 확인할 수 있다.
 */
export function AssetImage({
  src,
  alt,
  width,
  height,
  className,
}: AssetImageProps) {
  if (!src) {
    // 고정 px 대신 aspect-ratio 사용 → className의 width(clamp 등)에 맞춰 반응형으로 축소.
    return (
      <div
        role="img"
        aria-label={alt}
        style={{ aspectRatio: `${width} / ${height}` }}
        className={`flex max-w-full items-center justify-center rounded-xl border-2 border-dashed border-cream/50 bg-black/20 px-2 text-center text-xs text-cream/70 ${className ?? ""}`}
      >
        {alt}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
    />
  );
}
