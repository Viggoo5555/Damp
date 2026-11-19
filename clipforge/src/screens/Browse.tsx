import { useMemo, useState } from "react";
import type { Platform } from "../types";
import { useStore } from "../store";
import { BROWSE_CATEGORIES, BROWSE_ITEMS, CATEGORY_GRADE, type BrowseItem } from "../lib/library";
import { cx, duration, formatNumber } from "../lib/util";
import { Button, Chip, Segmented, Surface } from "../components/ui";
import {
  ArrowRightIcon,
  CloseIcon,
  CompassIcon,
  PlayIcon,
  SearchIcon,
  SparkIcon,
  TwitchMark,
  YoutubeMark,
} from "../components/Icons";

type Sort = "trending" | "new" | "clips";

function channelMark(channel: string) {
  return channel.replace(/[^a-z0-9]/gi, "").slice(0, 1).toUpperCase() || "?";
}

function VideoCard({
  item,
  inLibrary,
  onClip,
}: {
  item: BrowseItem;
  inLibrary: boolean;
  onClip: (item: BrowseItem) => void;
}) {
  const PlatformMark = item.platform === "twitch" ? TwitchMark : YoutubeMark;
  return (
    <button type="button" className="video-card" onClick={() => onClip(item)}>
      <span className="video-card__thumb">
        <img src={item.poster} alt="" style={{ objectPosition: item.posterPosition }} loading="lazy" />
        <span className="video-card__grade" style={{ background: CATEGORY_GRADE[item.category] }} />
        <span className="video-card__platform">
          <PlatformMark size={12} />
          {item.platform === "twitch" ? "Twitch" : "YouTube"}
        </span>
        {item.live ? (
          <span className="video-card__live">
            <span className="dot" />
            live
          </span>
        ) : (
          <span className="video-card__duration mono">{duration(item.durationSec)}</span>
        )}
        <span className="video-card__action">
          <PlayIcon size={13} />
          Find the funny bits
        </span>
      </span>

      <span className="video-card__body">
        <span className="video-card__top">
          <span className="video-card__avatar">{channelMark(item.channel)}</span>
          <span className="video-card__channel">{item.channel}</span>
          {inLibrary ? <span className="video-card__flag">in library</span> : null}
        </span>
        <span className="video-card__title">{item.title}</span>
        <span className="video-card__meta">
          {item.category}
          <span className="clip__sep">·</span>
          {item.posted}
          <span className="clip__sep">·</span>
          {item.live ? `${formatNumber(item.viewers)} watching` : `${formatNumber(item.views)} views`}
        </span>
        <span className="video-card__density">
          <span className="video-card__density-bar">
            <span style={{ width: `${Math.min(100, (item.clipsPerHour / 18) * 100)}%` }} />
          </span>
          <span>~{item.clipsPerHour} clips/hr</span>
        </span>
      </span>
    </button>
  );
}

export function Browse({ onClip }: { onClip: (item: BrowseItem) => void }) {
  const { state } = useStore();
  const [platform, setPlatform] = useState<"all" | Platform>("all");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("trending");
  const [liveOnly, setLiveOnly] = useState(false);

  const libraryUrls = useMemo(() => new Set(state.sources.map((source) => source.url)), [state.sources]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = BROWSE_ITEMS.filter((item) => {
      if (platform !== "all" && item.platform !== platform) return false;
      if (category !== "All" && item.category !== category) return false;
      if (liveOnly && !item.live) return false;
      if (
        needle &&
        !`${item.title} ${item.channel} ${item.category}`.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "clips") return b.clipsPerHour - a.clipsPerHour;
      if (sort === "new") return BROWSE_ITEMS.indexOf(a) - BROWSE_ITEMS.indexOf(b);
      if (a.live !== b.live) return a.live ? -1 : 1;
      return b.viewers + b.views / 200 - (a.viewers + a.views / 200);
    });
  }, [platform, category, query, sort, liveOnly]);

  const featured = results.find((item) => item.featured) ?? results[0];
  const grid = results.filter((item) => item.id !== featured?.id);
  const filtersActive = platform !== "all" || category !== "All" || liveOnly || query.length > 0;

  const clearFilters = () => {
    setPlatform("all");
    setCategory("All");
    setLiveOnly(false);
    setQuery("");
  };

  return (
    <div className="browse">
      <Surface className="browse-bar">
        <label className="browse-search">
          <SearchIcon size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search creators, titles, categories"
            aria-label="Search public videos"
            spellCheck={false}
          />
          {query ? (
            <button type="button" className="browse-search__clear" aria-label="Clear search" onClick={() => setQuery("")}>
              <CloseIcon size={14} />
            </button>
          ) : null}
        </label>

        <Segmented
          label="Platform"
          value={platform}
          onChange={(value) => setPlatform(value)}
          options={[
            { value: "all", label: "All" },
            { value: "youtube", label: "YouTube" },
            { value: "twitch", label: "Twitch" },
          ]}
        />

        <Segmented
          size="sm"
          label="Sort"
          value={sort}
          onChange={(value) => setSort(value)}
          options={[
            { value: "trending", label: "Trending" },
            { value: "new", label: "Newest" },
            { value: "clips", label: "Most clippable" },
          ]}
        />
      </Surface>

      <div className="browse-cats">
        {BROWSE_CATEGORIES.map((option) => (
          <button
            key={option}
            type="button"
            className={cx("filter-chip", category === option && "is-on")}
            onClick={() => setCategory(option)}
            aria-pressed={category === option}
          >
            {option}
          </button>
        ))}
        <button
          type="button"
          className={cx("filter-chip filter-chip--live", liveOnly && "is-on")}
          onClick={() => setLiveOnly((value) => !value)}
          aria-pressed={liveOnly}
        >
          <span className="dot" />
          Live now
        </button>
      </div>

      {featured ? (
        <button type="button" className="feature" onClick={() => onClip(featured)}>
          <span className="feature__thumb">
            <img src={featured.poster} alt="" style={{ objectPosition: featured.posterPosition }} />
            <span className="video-card__grade" style={{ background: CATEGORY_GRADE[featured.category] }} />
            <span className="feature__platform">
              {featured.live ? <span className="dot" /> : null}
              {featured.platform === "twitch" ? "Twitch" : "YouTube"} · {featured.category}
            </span>
            {featured.live ? <span className="feature__live">live</span> : null}
          </span>

          <span className="feature__body">
            <span className="feature__kicker">
              {featured.live ? "Happening right now" : "Picked for you"}
            </span>
            <span className="feature__title">{featured.title}</span>
            <span className="feature__channel">
              <span className="video-card__avatar">{channelMark(featured.channel)}</span>
              {featured.channel}
            </span>

            <span className="feature__stats">
              <span>
                <b>{featured.live ? formatNumber(featured.viewers) : formatNumber(featured.views)}</b>
                {featured.live ? "watching" : "views"}
              </span>
              <span>
                <b>~{featured.clipsPerHour}</b>clips / hour
              </span>
              <span>
                <b>{featured.live ? "live" : duration(featured.durationSec)}</b>
                {featured.live ? "source" : "runtime"}
              </span>
            </span>

            <span className="feature__cta">
              <span>
                Cut this {featured.live ? "stream" : "video"}
                <small>Subtitles, reframe and viral pass included</small>
              </span>
              <span className="feature__go">
                <ArrowRightIcon size={17} />
              </span>
            </span>
          </span>
        </button>
      ) : null}

      <div className="section-head">
        <div>
          <h2>{query.trim() ? `Results for “${query.trim()}”` : "New this week"}</h2>
          <p>
            {results.length} public {results.length === 1 ? "video" : "videos"} from creators who allow clipping.
          </p>
        </div>
        <Chip tone="ready">
          <SparkIcon size={13} />
          clipping allowed
        </Chip>
      </div>

      {grid.length ? (
        <div className="video-grid">
          {grid.map((item) => (
            <VideoCard
              key={item.id}
              item={item}
              inLibrary={libraryUrls.has(item.url)}
              onClip={onClip}
            />
          ))}
        </div>
      ) : (
        <Surface className="panel-empty">
          <CompassIcon size={24} />
          <h3>Nothing matches those filters</h3>
          <p>Try another category or clear the search to see every source again.</p>
          <Button variant="glass" onClick={clearFilters}>
            Clear filters
          </Button>
        </Surface>
      )}

      <p className="browse-note">
        Sourced from public streams and uploads with clipping enabled. Nothing downloads until you pick one —
        and cuts stay on this machine.
        {filtersActive ? (
          <>
            {" "}
            <button type="button" className="link-btn" onClick={clearFilters}>
              Reset filters
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}
