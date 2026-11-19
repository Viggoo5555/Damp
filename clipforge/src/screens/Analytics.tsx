import { useMemo, useState, type ReactNode } from "react";
import type { Clip, ClipPlatform } from "../types";
import { useStore } from "../store";
import {
  deltaPercent,
  previousTotals,
  totalsFor,
  trend,
  type Period,
} from "../lib/analytics";
import { formatMoney, formatNumber, sum } from "../lib/util";
import { AreaChart, Sparkline } from "../components/Charts";
import { PostSheet } from "../components/PostSheet";
import { Chip, Segmented, Surface } from "../components/ui";
import {
  BoltIcon,
  EyeIcon,
  InstagramMark,
  TiktokMark,
  TrendDownIcon,
  TrendUpIcon,
  UsersIcon,
  WalletIcon,
  YoutubeMark,
} from "../components/Icons";

type Metric = "earnings" | "views" | "subscribers";

const METRIC_LABEL: Record<Metric, string> = {
  earnings: "Earnings",
  views: "Views",
  subscribers: "Subscribers",
};

function Delta({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <span className="delta delta--flat">no earlier data</span>;
  const up = value >= 0;
  return (
    <span className={`delta ${up ? "delta--up" : "delta--down"}`} title={label}>
      {up ? <TrendUpIcon size={13} /> : <TrendDownIcon size={13} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  series,
  footnote,
  icon,
}: {
  label: string;
  value: string;
  delta: number | null;
  deltaLabel: string;
  series: number[];
  footnote: string;
  icon: ReactNode;
}) {
  return (
    <Surface className="stat-card" interactive>
      <div className="stat-card__head">
        <span className="stat-card__icon">{icon}</span>
        <span className="stat__label">{label}</span>
        <Delta value={delta} label={deltaLabel} />
      </div>
      <strong className="stat-card__value">{value}</strong>
      <div className="stat-card__foot">
        <span>{footnote}</span>
        <Sparkline data={series} className="stat-card__spark" />
      </div>
    </Surface>
  );
}

const PLATFORM_ICON: Record<ClipPlatform, (props: { size?: number }) => ReactNode> = {
  shorts: YoutubeMark,
  tiktok: TiktokMark,
  reels: InstagramMark,
};

const PLATFORM_NAME: Record<ClipPlatform, string> = {
  shorts: "Shorts",
  tiktok: "TikTok",
  reels: "Reels",
};

export function Analytics() {
  const { state } = useStore();
  const [period, setPeriod] = useState<Period>(7);
  const [metric, setMetric] = useState<Metric>("earnings");
  const [openPostId, setOpenPostId] = useState<string | null>(null);

  const posts = state.posts;
  const current = totalsFor(posts, period);
  const previous = previousTotals(posts, period);
  const points = trend(posts, period);
  const deltaLabel = `vs previous ${period} days`;

  const metricSeries: Record<Metric, number[]> = {
    earnings: points.map((point) => point.earnings),
    views: points.map((point) => point.views),
    subscribers: points.map((point) => point.subscribers),
  };
  const metricFormat: Record<Metric, (value: number) => string> = {
    earnings: (value) => formatMoney(value, true),
    views: (value) => `${formatNumber(value)} views`,
    subscribers: (value) => `+${formatNumber(value)} subs`,
  };

  const rows = useMemo(() => {
    return posts
      .map((post) => ({
        post,
        clip: state.clips.find((clip) => clip.id === post.clipId) as Clip | undefined,
        stats: totalsFor([post], period),
      }))
      .filter((row) => row.stats.views > 0)
      .sort((a, b) => b.stats.earnings - a.stats.earnings);
  }, [posts, period, state.clips]);

  const platformRows = (["shorts", "tiktok", "reels"] as ClipPlatform[]).map((platform) => {
    const subset = posts.filter((post) => post.platform === platform);
    const totals = totalsFor(subset, period);
    return { platform, ...totals, count: subset.length };
  });
  const platformViews = sum(platformRows.map((row) => row.views)) || 1;
  const topPost = rows[0];
  const openPost = posts.find((post) => post.id === openPostId) ?? null;
  const openClip = openPost ? state.clips.find((clip) => clip.id === openPost.clipId) : undefined;

  return (
    <div className="analytics">
      <div className="section-head">
        <div>
          <h2>Last {period} days</h2>
          <p>
            {formatNumber(current.views)} views · {formatNumber(current.subscribers)} new subscribers ·{" "}
            {formatMoney(current.earnings, true)} earned
          </p>
        </div>
        <div className="section-head__tools">
          <Chip title="The channel ships with sample history so the dashboard has something to show.">
            sample channel data
          </Chip>
          <Segmented
            label="Period"
            value={period}
            onChange={(value) => setPeriod(value)}
            options={[
              { value: 7, label: "7 days" },
              { value: 14, label: "14 days" },
              { value: 30, label: "30 days" },
            ]}
          />
        </div>
      </div>

      <div className="stats">
        <StatCard
          label="Estimated earnings"
          value={formatMoney(current.earnings, true)}
          delta={deltaPercent(current.earnings, previous?.earnings)}
          deltaLabel={deltaLabel}
          series={metricSeries.earnings}
          footnote="net of platform share"
          icon={<WalletIcon size={17} />}
        />
        <StatCard
          label="Views"
          value={formatNumber(current.views)}
          delta={deltaPercent(current.views, previous?.views)}
          deltaLabel={deltaLabel}
          series={metricSeries.views}
          footnote={`${formatNumber(current.likes)} likes`}
          icon={<EyeIcon size={17} />}
        />
        <StatCard
          label="Subscribers"
          value={`+${formatNumber(current.subscribers)}`}
          delta={deltaPercent(current.subscribers, previous?.subscribers)}
          deltaLabel={deltaLabel}
          series={metricSeries.subscribers}
          footnote="from clips only"
          icon={<UsersIcon size={17} />}
        />
        <StatCard
          label="RPM"
          value={`$${current.rpm.toFixed(2)}`}
          delta={deltaPercent(current.rpm, previous?.rpm)}
          deltaLabel={deltaLabel}
          series={points.map((point) => (point.views > 0 ? (point.earnings / point.views) * 1000 : 0))}
          footnote="per 1,000 views"
          icon={<BoltIcon size={17} />}
        />
      </div>

      <div className="analytics__mid">
        <Surface className="chart-card">
          <div className="card-head">
            <div>
              <h2>{METRIC_LABEL[metric]} over time</h2>
              <p>Everything reported locally from your published cuts.</p>
            </div>
            <Segmented
              size="sm"
              label="Chart metric"
              value={metric}
              onChange={(value) => setMetric(value)}
              options={[
                { value: "earnings", label: "Earnings" },
                { value: "views", label: "Views" },
                { value: "subscribers", label: "Subs" },
              ]}
            />
          </div>
          <AreaChart
            data={metricSeries[metric]}
            labels={points.map((point) => point.label)}
            formatValue={metricFormat[metric]}
            height={252}
          />
        </Surface>

        <Surface className="split-card">
          <div className="card-head">
            <div>
              <h2>Where it comes from</h2>
              <p>Views by destination</p>
            </div>
          </div>
          <div className="split">
            {platformRows.map((row) => {
              const Icon = PLATFORM_ICON[row.platform];
              const share = (row.views / platformViews) * 100;
              return (
                <div className="split__row" key={row.platform}>
                  <span className="split__icon">
                    <Icon size={16} />
                  </span>
                  <div className="split__body">
                    <div className="split__line">
                      <span>{PLATFORM_NAME[row.platform]}</span>
                      <span className="mono">{Math.round(share)}%</span>
                    </div>
                    <div className="split__track">
                      <span style={{ width: `${share}%` }} className={`split__fill split__fill--${row.platform}`} />
                    </div>
                    <div className="split__meta">
                      <span>{formatNumber(row.views)} views</span>
                      <span>{formatMoney(row.earnings, true)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {topPost ? (
            <button type="button" className="top-cut" onClick={() => setOpenPostId(topPost.post.id)}>
              <span className="top-cut__label">Top cut</span>
              <span className="top-cut__body">
                <span className="top-cut__title">{topPost.post.title}</span>
                <span className="top-cut__meta">
                  {formatNumber(topPost.stats.views)} views · {formatMoney(topPost.stats.earnings, true)}
                </span>
              </span>
              <span className="top-cut__arrow">↗</span>
            </button>
          ) : null}
        </Surface>
      </div>

      <Surface className="table-card">
        <div className="card-head">
          <div>
            <h2>Every video</h2>
            <p>{rows.length} posts with views in this window. Open one for its own numbers.</p>
          </div>
        </div>

        <div className="table" aria-label="Performance by video">
          <div className="table__head">
            <span>Video</span>
            <span>Views</span>
            <span>Watch</span>
            <span>Subs</span>
            <span>Earnings</span>
            <span>Published</span>
          </div>
          {rows.map(({ post, clip, stats }) => {
            const Icon = PLATFORM_ICON[post.platform];
            return (
              <button
                type="button"
                className="table__row"
                key={post.id}
                onClick={() => setOpenPostId(post.id)}
              >
                <span className="table__video">
                  <span className="table__thumb">
                    {clip ? <img src={clip.poster} alt="" style={{ objectPosition: clip.posterPosition }} /> : null}
                  </span>
                  <span className="table__titles">
                    <span className="table__title">{post.title}</span>
                    <span className="table__sub">
                      <Icon size={12} />
                      {PLATFORM_NAME[post.platform]}
                      {clip?.chatSpike ? (
                        <>
                          <span className="clip__sep">·</span>
                          <BoltIcon size={11} /> spike
                        </>
                      ) : null}
                    </span>
                  </span>
                </span>
                <span className="mono">
                  {formatNumber(stats.views)}
                </span>
                <span className="mono">
                  {Math.round(post.watchThrough * 100)}%
                </span>
                <span className="mono">
                  +{formatNumber(stats.subscribers)}
                </span>
                <span className="mono table__money">
                  {formatMoney(stats.earnings, true)}
                </span>
                <span className="mono table__date">
                  {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </button>
            );
          })}
        </div>

        <footer className="table-card__foot">
          <span>Earnings are estimates from reported views and your platform RPM.</span>
          <span className="mono">settles monthly</span>
        </footer>
      </Surface>

      <PostSheet
        post={openPost}
        clip={openClip}
        period={period}
        onClose={() => setOpenPostId(null)}
      />
    </div>
  );
}
