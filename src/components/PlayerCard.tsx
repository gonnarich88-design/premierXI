/** แสดงรูปการ์ดนักเตะเต็มใบ (รูปมีกรอบ/สถิติในตัวแล้ว) */
export default function PlayerCard({
  imageUrl,
  name,
  ovr,
  position,
  className = "",
}: {
  imageUrl?: string | null;
  name: string;
  ovr: number;
  position: string;
  className?: string;
}) {
  // encode path เผื่อชื่อไฟล์มีเว้นวรรค/อักขระ unicode
  const src = imageUrl ? encodeURI(imageUrl) : null;

  return (
    <div className={`relative aspect-[900/1269] ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          loading="lazy"
          className="h-full w-full object-contain drop-shadow-lg"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border border-border bg-surface-2 text-center">
          <span className="text-2xl font-bold">{ovr}</span>
          <span className="text-xs text-muted">{position}</span>
          <span className="mt-1 px-2 text-sm">{name}</span>
        </div>
      )}
    </div>
  );
}
