import { useParams, useNavigate, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useBlog } from "../hooks";
import { Spinner, StatusPill, Kicker, Avatar } from "../components/UI";
import { BackButton } from "../components/BackButton";
import { CommentSection } from "../components/CommentSection";
import { useAuthStore } from "../store/auth";
import { Trash2, Pencil, MoreVertical, Heart, ChevronDown, ChevronUp, List } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { isAdmin } from "../utils/roles";

interface TocItem {
  level: number;
  text: string;
  id: string;
}

function extractToc(markdown: string): TocItem[] {
  const headings: TocItem[] = [];
  const lines = markdown.split("\n");
  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)/);
    if (m) {
      const text = m[2].trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      headings.push({ level: m[1].length, text, id });
    }
  }
  return headings;
}

function TableOfContents({ items, className }: { items: TocItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav className={className} aria-label="Table of contents">
      <p className="font-mononum text-[10px] uppercase tracking-[0.1em] text-ink-sub mb-2">Contents</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} style={{ paddingLeft: `${(item.level - 1) * 12}px` }}>
            <a
              href={`#${item.id}`}
              className="text-[12.5px] text-ink-70 hover:text-brand-500 transition leading-snug block py-0.5"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function BlogDetail() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { id: idOrSlug = "" } = useParams();
  const [pendingDelete, setPendingDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const { detail: q, remove: deleteBlog, like, unlike } = useBlog(idOrSlug, {
    onDeleteSuccess: () => navigate("/blogs"),
  });

  const b = q.data;
  const toc = useMemo(() => (b ? extractToc(b.body_markdown ?? "") : []), [b]);

  if (q.isLoading) return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;
  if (q.isError || !b) return <div className="panel p-8 text-center font-disp text-xl text-ink-70">Blog not found.</div>;

  const canEdit = user?.id === b.author_id || isAdmin(user?.role ?? "");
  const publishedDate = new Date(b.published_at ?? b.created_at).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
  const wordCount = (b.body_markdown ?? "").replace(/[#*`>_\-\[\]!]/g, "").trim().split(/\s+/).length;
  const readTimeStr = `${Math.ceil(wordCount / 200)} min read`;

  function handleLikeToggle() {
    if (!user) return;
    if (b!.liked) unlike.mutate();
    else like.mutate();
  }

  return (
    <div className="max-w-5xl mx-auto">
      <BackButton label="Blogs" className="mb-3" />

      <div className="lg:flex lg:gap-8 lg:items-start">
        {/* Main content */}
        <article className="flex-1 min-w-0 space-y-0">
          {/* Cover */}
          {b.cover_image_url && (
            <img
              src={b.cover_image_url}
              alt=""
              className="w-full aspect-video object-cover rounded-t border-x border-t border-hair"
            />
          )}

          {/* Header */}
          <div className={`panel p-6 md:p-8 ${b.cover_image_url ? "rounded-t-none border-t-0" : ""}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {b.sport && <Kicker>{b.sport}</Kicker>}
                  <StatusPill status={b.status} />
                  {b.tags?.map((tag) => (
                    <span key={tag} className="badge">{tag}</span>
                  ))}
                </div>
                <h1 className="font-disp text-2xl md:text-4xl lg:text-5xl leading-tight">{b.title}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <Avatar
                    name={b.author?.full_name ?? b.author_name}
                    src={b.author?.profile_photo_url}
                    size={32}
                    square={false}
                  />
                  <div>
                    <div className="text-[13px] font-semibold text-ink">{b.author_name}</div>
                    <div className="text-[11px] text-ink-faint">{publishedDate} · {readTimeStr}</div>
                  </div>
                  <div className="ml-auto lab">◎ {b.view_count} views</div>
                </div>
              </div>
              {canEdit && (
                <div className="relative shrink-0" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="btn-ghost p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-1 panel shadow-pop z-10 min-w-36">
                      <Link
                        to={`/blogs/${b.id}/edit`}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-ink hover:bg-fill border-b border-hairsoft min-h-[44px]"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Link>
                      <button
                        onClick={() => { setPendingDelete(true); setMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-red-600 hover:bg-red-50 min-h-[44px]"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {pendingDelete && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded bg-red-50 border border-red-200 p-4">
                <div className="flex-1">
                  <p className="font-semibold text-red-900">Delete this blog?</p>
                  <p className="text-sm text-red-700 mt-0.5">This cannot be undone.</p>
                </div>
                <button
                  onClick={() => deleteBlog.mutate()}
                  disabled={deleteBlog.isPending}
                  className="btn-danger min-h-[44px]"
                >
                  Confirm delete
                </button>
                <button onClick={() => setPendingDelete(false)} className="btn-secondary min-h-[44px]">
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Mobile TOC — collapsible */}
          {toc.length > 0 && (
            <div className="lg:hidden panel border-t-0 rounded-t-none rounded-b-none px-6 py-3">
              <button
                onClick={() => setTocOpen(!tocOpen)}
                className="flex items-center gap-2 w-full text-left min-h-[44px] font-mononum text-[11px] uppercase tracking-[0.08em] text-ink-sub"
              >
                <List className="h-4 w-4" />
                Table of Contents
                {tocOpen ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
              </button>
              {tocOpen && (
                <div className="pt-2 pb-1">
                  <TableOfContents items={toc} />
                </div>
              )}
            </div>
          )}

          {/* Body */}
          <div className={`panel p-6 md:p-8 border-t-0 rounded-t-none ${toc.length > 0 ? "lg:rounded-t-none" : ""}`}>
            <div className="prose prose-slate max-w-none text-base leading-relaxed prose-headings:font-disp prose-headings:tracking-tight prose-a:text-brand-500 prose-img:rounded">
              <ReactMarkdown>{b.body_markdown}</ReactMarkdown>
            </div>

            {/* Stats row (desktop — like is floating on mobile) */}
            <div className="mt-8 pt-6 border-t border-hairsoft flex items-center gap-6">
              <button
                onClick={handleLikeToggle}
                disabled={!user || like.isPending || unlike.isPending}
                className={`font-mononum text-[11px] uppercase tracking-[0.08em] flex items-center gap-2 transition py-2 px-1 -mx-1 min-h-[44px] hidden lg:flex ${
                  b.liked ? "text-brand-500" : "text-ink-sub hover:text-brand-500"
                }`}
              >
                <Heart className={`h-4 w-4 ${b.liked ? "fill-brand-500" : ""}`} />
                {b.like_count} {b.like_count === 1 ? "like" : "likes"}
              </button>
              <span className="font-mononum text-[11px] text-ink-faint">❝ {b.comment_count} comments</span>
            </div>

            <div className="mt-6">
              <CommentSection parentType="blog" parentId={b.id} commentCount={b.comment_count} />
            </div>
          </div>
        </article>

        {/* Desktop sticky TOC sidebar */}
        {toc.length > 0 && (
          <aside className="hidden lg:block w-56 shrink-0 sticky top-6">
            <div className="panel p-4">
              <TableOfContents items={toc} />
            </div>
          </aside>
        )}
      </div>

      {/* Mobile floating like button */}
      {user && (
        <button
          onClick={handleLikeToggle}
          disabled={like.isPending || unlike.isPending}
          className={`lg:hidden fixed bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] right-4 z-50 h-14 w-14 rounded-full shadow-card flex items-center justify-center transition ${
            b.liked
              ? "bg-brand-500 text-white"
              : "bg-panel border border-hair text-ink-sub hover:text-brand-500"
          }`}
          aria-label={b.liked ? "Unlike" : "Like"}
        >
          <Heart className={`h-6 w-6 ${b.liked ? "fill-white" : ""}`} />
        </button>
      )}
    </div>
  );
}
