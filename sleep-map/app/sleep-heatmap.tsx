"use client";

import { useMemo, useState } from "react";

type SleepDay = {
  date: string;
  mainMinutes: number;
  napMinutes: number;
  totalMinutes: number;
  bedtime: string | null;
  wakeTime: string | null;
  hasNap: boolean;
  sessions: number;
  anomaly: boolean;
};

type MosaicDay = {
  date: string;
  sleep?: SleepDay;
  future: boolean;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + count);
  return next;
}

function durationLevel(minutes?: number) {
  if (!minutes) return 0;
  if (minutes < 360) return 1;
  if (minutes < 420) return 2;
  if (minutes < 480) return 3;
  if (minutes <= 540) return 4;
  return 5;
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest.toString().padStart(2, "0")}m`;
}

function formatCompactMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function readableDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function SleepHeatmap({
  startYear,
  endYear,
  days,
}: {
  startYear: number;
  endYear: number;
  days: SleepDay[];
}) {
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const mosaic = useMemo(() => {
    const byDate = new Map(days.map((day) => [day.date, day]));
    const start = new Date(Date.UTC(startYear, 0, 1));
    const end = new Date(Date.UTC(endYear, 11, 31));
    const today = isoDate(new Date());
    const result: MosaicDay[] = [];

    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      const date = isoDate(cursor);
      result.push({
        date,
        sleep: byDate.get(date),
        future: date > today,
      });
    }

    return result;
  }, [days, endYear, startYear]);

  const active = activeDate
    ? days.find((day) => day.date === activeDate)
    : undefined;
  const averageMinutes = Math.round(
    days.reduce((total, day) => total + day.totalMinutes, 0) / days.length,
  );

  return (
    <div className="mosaic-card">
      <div className="mosaic-meta">
        <p className="site-period">
          {startYear}–{endYear}
        </p>
        <div
          className={`site-stats ${active ? "is-detail" : ""}`}
          aria-live="polite"
        >
          {active ? (
            <>
              <span>{readableDate(active.date)}</span>
              <span className="status-value detail-line">
                <i
                  className={`status-dot level-${durationLevel(active.totalMinutes)}`}
                  aria-hidden="true"
                />
                <strong>{formatMinutes(active.totalMinutes)}</strong>
                {active.bedtime && active.wakeTime && (
                  <>
                    <i className="detail-separator" aria-hidden="true">
                      ·
                    </i>
                    <span>
                      {active.bedtime}–{active.wakeTime}
                    </span>
                  </>
                )}
                {active.hasNap && (
                  <>
                    <i className="detail-separator" aria-hidden="true">
                      ·
                    </i>
                    <span>nap {formatCompactMinutes(active.napMinutes)}</span>
                  </>
                )}
              </span>
            </>
          ) : (
            <>
              <span>
                <strong>{days.length}</strong> days
              </span>
              <span className="status-value">
                <i
                  className={`status-dot level-${durationLevel(averageMinutes)}`}
                  aria-hidden="true"
                />
                avg <strong>{formatMinutes(averageMinutes)}</strong>
              </span>
            </>
          )}
        </div>
      </div>

      <div
        className="sleep-mosaic"
        aria-label={`${startYear} to ${endYear} sleep mosaic`}
      >
        {mosaic.map((day) => {
          const level = durationLevel(day.sleep?.totalMinutes);
          const label = day.sleep
            ? `${readableDate(day.date)}: ${formatMinutes(day.sleep.totalMinutes)} total sleep`
            : `${readableDate(day.date)}: ${day.future ? "future date" : "no sleep data"}`;

          return (
            <button
              key={day.date}
              type="button"
              className={[
                "mosaic-cell",
                `level-${level}`,
                day.future ? "is-future" : "",
                day.sleep?.anomaly ? "is-anomaly" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={label}
              onBlur={() => setActiveDate(null)}
              onClick={() => setActiveDate(day.date)}
              onFocus={() => setActiveDate(day.date)}
              onMouseEnter={() => setActiveDate(day.date)}
              onMouseLeave={() => setActiveDate(null)}
            />
          );
        })}
        {Array.from({ length: 10 }, (_, index) => (
          <i
            className={[
              "mosaic-cell",
              "mosaic-padding",
              index > 6 ? "mobile-only-padding" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden="true"
            key={`padding-${index}`}
          />
        ))}
      </div>

    </div>
  );
}
