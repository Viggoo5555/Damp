import type { Post } from "../types";
import { dayLabel, sum } from "./util";

export type Period = 7 | 14 | 30;

export interface AnalyticsTotals {
  views: number;
  earnings: number;
  subscribers: number;
  likes: number;
  rpm: number;
}

export interface TrendPoint {
  label: string;
  views: number;
  earnings: number;
  subscribers: number;
}

function dayViews(post: Post, days: Period): number[] {
  return post.series.slice(30 - days);
}

export function totalsFor(posts: Post[], days: Period): AnalyticsTotals {
  const views = posts.reduce((total, post) => total + sum(dayViews(post, days)), 0);
  const earnings = posts.reduce((total, post) => {
    const lifeViews = post.views || 1;
    return total + (sum(dayViews(post, days)) / lifeViews) * post.earnings;
  }, 0);
  const subscribers = posts.reduce((total, post) => {
    const lifeViews = post.views || 1;
    return total + Math.round((sum(dayViews(post, days)) / lifeViews) * post.subscribers);
  }, 0);
  const likes = posts.reduce((total, post) => {
    const lifeViews = post.views || 1;
    return total + Math.round((sum(dayViews(post, days)) / lifeViews) * post.likes);
  }, 0);
  return {
    views,
    earnings,
    subscribers,
    likes,
    rpm: views > 0 ? (earnings / views) * 1000 : 0,
  };
}

export function previousTotals(posts: Post[], days: Period): AnalyticsTotals | null {
  if (days >= 30) return null;
  // Posts carry 30 days of history; the comparison window sits directly before the current one.
  const slice = (post: Post) => post.series.slice(30 - days * 2, 30 - days);
  const views = posts.reduce((total, post) => total + sum(slice(post)), 0);
  if (views === 0) return null;
  const earnings = posts.reduce((total, post) => {
    const lifeViews = post.views || 1;
    return total + (sum(slice(post)) / lifeViews) * post.earnings;
  }, 0);
  const subscribers = posts.reduce((total, post) => {
    const lifeViews = post.views || 1;
    return total + Math.round((sum(slice(post)) / lifeViews) * post.subscribers);
  }, 0);
  return { views, earnings, subscribers, likes: 0, rpm: (earnings / views) * 1000 };
}

export function trend(posts: Post[], days: Period): TrendPoint[] {
  const today = new Date();
  return Array.from({ length: days }, (_, index) => {
    const seriesIndex = 30 - days + index;
    const date = new Date(today.getTime() - (days - 1 - index) * 86_400_000);
    const views = posts.reduce((total, post) => total + (post.series[seriesIndex] ?? 0), 0);
    const earnings = posts.reduce((total, post) => {
      const lifeViews = post.views || 1;
      return total + ((post.series[seriesIndex] ?? 0) / lifeViews) * post.earnings;
    }, 0);
    const subscribers = posts.reduce((total, post) => {
      const lifeViews = post.views || 1;
      return total + Math.round(((post.series[seriesIndex] ?? 0) / lifeViews) * post.subscribers);
    }, 0);
    return { label: dayLabel(date), views, earnings, subscribers };
  });
}

export function deltaPercent(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function clipTotals(post: Post, days: Period): AnalyticsTotals {
  return totalsFor([post], days);
}

export function postWindowViews(post: Post, days: Period): number[] {
  return dayViews(post, days);
}
