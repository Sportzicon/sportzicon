import type { PostMedia } from "../../../models";

export function MediaCarousel({ media }: { media: PostMedia[] }) {
  if (!media || media.length === 0) return null;
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto snap-x snap-mandatory rounded-lg">
      {media.map((m, i) => (
        <div key={i} className="flex-shrink-0 w-full snap-center rounded-lg bg-fill overflow-hidden">
          {m.type === "image" ? (
            <img src={m.url} alt="" className="w-full h-80 object-contain" loading="lazy" />
          ) : (
            <video src={m.url} controls className="w-full h-80 object-contain" />
          )}
        </div>
      ))}
    </div>
  );
}
