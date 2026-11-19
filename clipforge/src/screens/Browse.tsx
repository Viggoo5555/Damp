import { useMemo, useState } from "react";
import type { Platform } from "../types";
import { useStore } from "../store";
import { BROWSE_CATEGORIES, BROWSE_ITEMS, CATEGORY_GRADE, type BrowseItem } from "../lib/library";
import { cx, formatNumber } from "../lib/util";
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

type Sort = "biggest" | "az";

function channelMark(channel: string) {
  return channel.replace(/[^a-z0-9]/gi, "").slice(0, 1).toUpperCase() || "?";
}

function audience(item: BrowseItem) {
  return `${formatNumber(item.followers)} ${item.metric}`;
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
        <span className="video-card__duration mono">latest VOD</span>
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
          {audience(item)}
          <span className="clip__sep">·</span>
          {item.platform === "twitch" ? "streams" : "uploads"}
        </span>
        <span className="video-card__density">
          <span>Resolves that channel's newest long stream when you run it</span>
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
  const [sort, setSort] = useState<Sort>("biggest");

  const libraryUrls = useMemo(() => new Set(state.sources.map((source) => source.url)), [state.sources]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = BROWSE_ITEMS.filter((item) => {
      if (platform !== "all" && item.platform !== platform) return false;
      if (category === "Big streamers" && item.kind !== "streamer") return false;
      if (category !== "All" && category !== "Big streamers" && item.category !== category) return false;
      if (needle && !`${item.title} ${item.channel} ${item.category}`.toLowerCase().includes(needle)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      // Big streamers lead; everything else follows.
      if (a.kind !== b.kind) return a.kind === "streamer" ? -1 : 1;
      if (sort === "az") return a.channel.localeCompare(b.channel);
      return b.followers - a.followers;
    });
  }, [platform, category, query, sort]);

  const featured = results.find((item) => item.featured) ?? results[0];
  const grid = results.filter((item) => item.id !== featured?.id);
  const filtersActive = platform !== "all" || category !== "All" || query.length > 0;

  const clearFilters = () => {
    setPlatform("all");
    setCategory("All");
    setQuery("");
  };

  const streamerCount = BROWSE_ITEMS.filter((item) => item.kind === "streamer").length;

  return (
    <div className="browse">
      <Surface className="browse-bar">
        <label className="browse-search">
          <SearchIcon size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search creators, categories"
            aria-label="Search clippable creators"
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
            { value: "biggest", label: "Biggest" },
            { value: "az", label: "A–Z" },
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
      </div>

      {featured ? (
        <button type="button" className="feature" onClick={() => onClip(featured)}>
          <span className="feature__thumb">
            <img src={featured.poster} alt="" style={{ objectPosition: featured.posterPosition }} />
            <span className="video-card__grade" style={{ background: CATEGORY_GRADE[featured.category] }} />
            <span className="feature__platform">
              {featured.platform === "twitch" ? "Twitch" : "YouTube"} · {featured.category}
            </span>
          </span>

          <span className="feature__body">
            <span className="feature__kicker">Biggest stream in the list</span>
            <span className="feature__title">{featured.channel}</span>
            <span className="feature__channel">
              <span className="video-card__avatar">{channelMark(featured.channel)}</span>
              {featured.title}
            </span>

            <span className="feature__stats">
              <span>
                <b>{formatNumber(featured.followers)}</b>
                {featured.metric}
              </span>
              <span>
                <b>{featured.platform === "twitch" ? "Twitch" : "YouTube"}</b>
                platform
              </span>
              <span>
                <b>latest VOD</b>
                resolved on run
              </span>
            </span>

            <span className="feature__cta">
              <span>
                Clip this channel
                <small>Takes the newest long stream, then finds the funny parts</small>
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
          <h2>
            {query.trim()
              ? `Results for “${query.trim()}”`
              : category === "Big streamers"
                ? "Big streamers"
                : "Big streamers, then everyone else"}
          </h2>
          <p>
            {results.length} clippable {results.length === 1 ? "channel" : "channels"} · {streamerCount} big streamers
            in the list · newest long stream is picked when you run it.
          </p>
        </div>
        <Chip tone="ready">
          <SparkIcon size={13} />
          public VODs
        </Chip>
      </div>

      {grid.length ? (
        <div className="video-grid">
          {grid.map((item) => (
            <VideoCard key={item.id} item={item} inLibrary={libraryUrls.has(item.url)} onClip={onClip} />
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
        Every channel here was checked to have public VODs. Nothing downloads until you pick one, and the cut files
        stay on this machine.
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
