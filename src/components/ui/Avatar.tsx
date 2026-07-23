const SIZES = {
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-16 w-16",
};

/**
 * Mini-card chip สี่เหลี่ยมมุมโค้ง (ไม่ใช่วงกลม) — ครอปจากภาพการ์ดจริงด้วย object-cover object-top
 * ตัดสินใจแล้วว่าไม่ใช้วงกลมเพราะ asset การ์ดมีกรอบ/สถิติวาดในตัว (ดู docs/design.md §2 Avatar)
 */
export default function Avatar({
  imageUrl,
  alt,
  size = "md",
  className = "",
}: {
  imageUrl?: string | null;
  alt: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const src = imageUrl ? encodeURI(imageUrl) : null;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2 ${SIZES[size]} ${className}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover object-top" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted">
          {alt.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}
