import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useBlogs } from "../../../hooks";
import { PageHeader, Spinner, EmptyState, Kicker, StatusPill, Avatar } from "../../../components/UI";
import { MobileDrawer } from "../../../components/MobileDrawer";
import { SlidersHorizontal, X, Search } from "lucide-react";
import type { Blog, BlogFilters } from "../../../models";

const SPORTS = [
  "Cricket", "Football", "Athletics", "Basketball", "Hockey",
  "Tennis", "Badminton", "Kabaddi", "Swimming", "Wrestling", "Boxing", "Volleyball",
];

const POPULAR_TAGS = ["fitness", "scouting", "trials", "coaching", "nutrition", "training", "mindset"];

function readTime(markdown: string): string {
  const words = markdown.replace(/[#*`>_\-\[\]!]/g, "").trim().split(/\s+/).length;
  return `${Math.ceil(words / 200)} min read`;
}

function BlogCard({ b, layout }: { b: Blog; layout: "grid" | "list" }) {
  const date = new Date(b.published_at ?? b.created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  if (layout === "list") {
    // Desktop: image left, content right
    return (
      <Link
        to={`/blogs/${b.id}`}
        className="panel overflow-hidden hover:shadow-card transition group flex gap-0"
      >
        {b.cover_image_url ? (
          <img
            src={b.cover_image_url}
            alt=""
            className="w-24 sm:w-48 object-cover shrink-0"
          />
        ) : (
          <div className="w-24 sm:w-48 shrink-0 bg-fill flex items-center justify-center">
            <span className="font-disp text-4xl text-ink-faint">✍</span>
          </div>
        )}
        <div className="p-5 flex flex-col flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <StatusPill status={b.status} />
            {b.sport && <Kicker>{b.sport}</Kicker>}
            {b.tags?.slice(0, 2).map((t) => (
              <span key={t} className="badge text-[10px]">{t}</span>
            ))}
          </div>
          <h3 className="font-disp text-xl leading-tight group-hover:text-brand-500 transition line-clamp-2">
            {b.title}
          </h3>
          <p className="text-sm text-ink-sub mt-2 line-clamp-2 flex-1">
            {b.excerpt || b.body_markdown?.slice(0, 120)}
          </p>
          <div className="mt-3 pt-3 border-t border-hairsoft flex items-center gap-3">
            <Avatar name={b.author?.full_name ?? b.author_name} src={b.author?.profile_photo_url} size={24} />
            <span className="text-[12px] text-ink-70">{b.author_name}</span>
            <span className="text-[12px] text-ink-faint">{date}</span>
            <span className="text-[11px] text-ink-faint ml-auto">{readTime(b.body_markdown ?? "")}</span>
          </div>
        </div>
      </Link>
    );
  }

  // Grid card (mobile + desktop grid)
  return (
    <Link
      to={`/blogs/${b.id}`}
      className="panel overflow-hidden hover:shadow-card transition group flex flex-col"
    >
      {b.cover_image_url ? (
        <div className="aspect-video overflow-hidden">
          <img src={b.cover_image_url} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-video bg-fill flex items-center justify-center">
          <span className="font-disp text-4xl text-ink-faint">✍</span>
        </div>
      )}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <StatusPill status={b.status} />
          {b.sport && <Kicker>{b.sport}</Kicker>}
          {b.tags?.slice(0, 1).map((t) => <span key={t} className="badge text-[10px]">{t}</span>)}
        </div>
        <h3 className="font-disp text-lg leading-tight group-hover:text-brand-500 transition line-clamp-2">
          {b.title}
        </h3>
        <p className="text-[13px] text-ink-sub mt-2 line-clamp-2 flex-1">
          {b.excerpt || b.body_markdown?.slice(0, 80)}
        </p>
        <div className="mt-3 pt-3 border-t border-hairsoft flex items-center gap-2">
          <Avatar name={b.author?.full_name ?? b.author_name} src={b.author?.profile_photo_url} size={20} />
          <span className="text-[11px] text-ink-70 flex-1 truncate">{b.author_name}</span>
          <span className="text-[11px] text-ink-faint">{date}</span>
          <span className="text-[11px] text-ink-faint">{readTime(b.body_markdown ?? "")}</span>
        </div>
      </div>
    </Link>
  );
}

export default function Blogs() {
  const [sport, setSport] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState("");
  const [searchRaw, setSearchRaw] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchRaw), 300);
    return () => clearTimeout(t);
  }, [searchRaw]);

  const filters: BlogFilters = {};
  if (status) filters.status = status;
  if (sport) filters.sport = sport;
  if (tag) filters.tag = tag;
  if (searchDebounced) filters.q = searchDebounced;

  const { infinite, allItems } = useBlogs(filters);
  const activeFilterCount = [sport, tag, status].filter(Boolean).length;

  const clearFilters = useCallback(() => {
    setSport("");
    setTag("");
    setStatus("");
  }, []);

  const filterContent = (
    <div className="space-y-4">
      <div>
        <p className="label mb-2">Status</p>
        <div className="flex flex-wrap gap-2">
          {["published", "draft"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(status === s ? "" : s)}
              className={`px-3 py-1.5 rounded border text-[12px] min-h-[44px] capitalize transition ${
                status === s
                  ? "bg-ink text-paper border-ink"
                  : "bg-fill text-ink-70 border-hair hover:border-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="label mb-2">Sport</p>
        <div className="flex flex-wrap gap-2">
          {SPORTS.map((s) => (
            <button
              key={s}
              onClick={() => setSport(sport === s ? "" : s)}
              className={`px-3 py-1.5 rounded border text-[12px] min-h-[44px] transition ${
                sport === s
                  ? "bg-ink text-paper border-ink"
                  : "bg-fill text-ink-70 border-hair hover:border-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="label mb-2">Popular Tags</p>
        <div className="flex flex-wrap gap-2">
          {POPULAR_TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? "" : t)}
              className={`px-3 py-1.5 rounded border text-[12px] min-h-[44px] transition ${
                tag === t
                  ? "bg-brand-500 text-white border-brand-500"
                  : "bg-fill text-ink-70 border-hair hover:border-brand-500"
              }`}
            >
              #{t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Blogs"
        subtitle="Guides & insights"
        sticky
      />

      {/* Mobile filter bar */}
      <div className="lg:hidden flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint pointer-events-none" />
          <input
            className="input w-full pl-9 min-h-[44px]"
            placeholder="Search blogs…"
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
          />
          {searchRaw && (
            <button
              onClick={() => setSearchRaw("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink min-h-[44px] flex items-center"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setFilterDrawerOpen(true)}
          className="btn-secondary min-h-[44px] flex items-center gap-1.5 relative"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-brand-500 text-white text-[9px] flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Main layout: sidebar + content */}
      <div className="flex gap-6 items-start">

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 sticky top-4 self-start">
          <div className="panel p-5 space-y-0">
            <div className="lab mb-4 font-semibold text-ink">Filters</div>

            {/* Search */}
            <div className="pb-4 mb-4 border-b border-hairsoft">
              <div className="lab mb-2">Search</div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-faint pointer-events-none" />
                <input
                  className="input w-full pl-8 text-sm"
                  placeholder="Search blogs…"
                  value={searchRaw}
                  onChange={(e) => setSearchRaw(e.target.value)}
                />
              </div>
            </div>

            {/* Status */}
            <div className="pb-4 mb-4 border-b border-hairsoft">
              <div className="lab mb-2">Status</div>
              <select
                className="input w-full text-sm min-h-[40px]"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            {/* Sport */}
            <div className="pb-4 mb-4 border-b border-hairsoft">
              <div className="lab mb-2">Sport</div>
              <select
                className="input w-full text-sm min-h-[40px]"
                value={sport}
                onChange={(e) => setSport(e.target.value)}
              >
                <option value="">All sports</option>
                {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Popular Tags */}
            <div>
              <div className="lab mb-2">Popular Tags</div>
              <div className="flex flex-col gap-0.5">
                {POPULAR_TAGS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTag(tag === t ? "" : t)}
                    className={`text-left px-3 py-2 rounded text-sm transition-colors min-h-[44px] ${
                      tag === t
                        ? "bg-brand-500 text-white"
                        : "hover:bg-fill text-ink-70"
                    }`}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>

            {(searchRaw || activeFilterCount > 0) && (
              <button
                onClick={() => { setSearchRaw(""); clearFilters(); }}
                className="mt-4 w-full btn-ghost min-h-[44px] text-sm"
              >
                Clear all filters
              </button>
            )}
          </div>
        </aside>

        {/* Blog content */}
        <div className="flex-1 min-w-0">
          {infinite.isLoading ? (
            <div className="panel p-8 flex justify-center">
              <Spinner className="text-brand-500" />
            </div>
          ) : allItems.length === 0 ? (
            <EmptyState
              title="No blogs found"
              hint={searchDebounced || activeFilterCount > 0 ? "Try adjusting your search or filters." : "Be the first to write a blog."}
              action={
                <div className="flex flex-wrap gap-2 justify-center">
                  {(searchDebounced || activeFilterCount > 0) && (
                    <button onClick={() => { setSearchRaw(""); clearFilters(); }} className="btn-secondary">
                      Clear filters
                    </button>
                  )}
                </div>
              }
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {allItems.map((b: Blog) => <BlogCard key={b.id} b={b} layout="grid" />)}
              </div>

              {infinite.hasNextPage && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={() => infinite.fetchNextPage()}
                    disabled={infinite.isFetchingNextPage}
                    className="btn-secondary min-h-[44px] px-8"
                  >
                    {infinite.isFetchingNextPage ? (
                      <span className="flex items-center gap-2"><Spinner className="text-ink-sub" /> Loading…</span>
                    ) : (
                      "Load more"
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* Mobile filter drawer */}
      <div className="lg:hidden">
        <MobileDrawer
          isOpen={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
          title={`Filters${activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}`}
          footer={
            <div className="p-3 flex gap-2">
              <button onClick={clearFilters} className="btn-secondary flex-1 min-h-[44px]">Clear all</button>
              <button onClick={() => setFilterDrawerOpen(false)} className="btn-accent flex-1 min-h-[44px]">Apply</button>
            </div>
          }
        >
          {filterContent}
        </MobileDrawer>
      </div>
    </div>
  );
}
