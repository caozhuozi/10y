"use client";

import { useMemo, useState, type KeyboardEvent } from "react";

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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [previewDate, setPreviewDate] = useState<string | null>(null);
  const [focusDate, setFocusDate] = useState(
    () => days.at(-1)?.date ?? `${startYear}-01-01`,
  );
  const activeDate = previewDate ?? selectedDate;

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
  const totalPlanDays =
    Math.round(
      (Date.UTC(endYear + 1, 0, 1) - Date.UTC(startYear, 0, 1)) / 86_400_000,
    );
  const latestYear = days.at(-1)
    ? Number(days.at(-1)!.date.slice(0, 4))
    : startYear;
  const chapterYear = Math.min(
    endYear - startYear + 1,
    Math.max(1, latestYear - startYear + 1),
  );
  const yearlyProgress = Array.from(
    { length: endYear - startYear + 1 },
    (_, index) => {
      const year = startYear + index;
      const daysInYear = Math.round(
        (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000,
      );
      const recordedDays = days.filter((day) =>
        day.date.startsWith(`${year}-`),
      ).length;
      return Math.min(100, (recordedDays / daysInYear) * 100);
    },
  );

  function handleMosaicKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      setSelectedDate(null);
      setPreviewDate(null);
      return;
    }

    const columns = window.matchMedia("(max-width: 760px)").matches ? 29 : 47;
    const column = index % columns;
    let nextIndex = index;

    if (event.key === "ArrowLeft" && column > 0) nextIndex -= 1;
    if (
      event.key === "ArrowRight" &&
      column < columns - 1 &&
      index + 1 < mosaic.length
    ) {
      nextIndex += 1;
    }
    if (event.key === "ArrowUp" && index >= columns) nextIndex -= columns;
    if (event.key === "ArrowDown" && index + columns < mosaic.length) {
      nextIndex += columns;
    }

    if (!event.key.startsWith("Arrow")) return;

    event.preventDefault();
    if (nextIndex === index) return;

    const buttons =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        "button.mosaic-cell",
      );
    buttons?.item(nextIndex).focus();
  }

  return (
    <div className="mosaic-card">
      <div className="mosaic-meta">
        <div
          className="site-period"
          aria-label={`${startYear} to ${endYear}. Year ${chapterYear}, day ${days.length} of ${totalPlanDays}.`}
        >
          <span className="period-years">
            {startYear}–{endYear}
          </span>
          <span className="period-progress" aria-hidden="true">
            {yearlyProgress.map((progress, index) => (
              <span className="period-segment" key={startYear + index}>
                <span style={{ width: `${progress}%` }} />
              </span>
            ))}
          </span>
        </div>
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
                    <span>+ {formatCompactMinutes(active.napMinutes)} nap</span>
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
        {mosaic.map((day, index) => {
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
              aria-pressed={selectedDate === day.date}
              tabIndex={focusDate === day.date ? 0 : -1}
              onBlur={() => setPreviewDate(null)}
              onClick={() => {
                setSelectedDate((current) =>
                  current === day.date ? null : day.date,
                );
                setPreviewDate(null);
              }}
              onFocus={() => {
                setFocusDate(day.date);
                setPreviewDate(day.date);
              }}
              onKeyDown={(event) => handleMosaicKeyDown(event, index)}
              onMouseEnter={() => setPreviewDate(day.date)}
              onMouseLeave={() => setPreviewDate(null)}
            />
          );
        })}
        {Array.from({ length: 7 }, (_, index) => (
          <i
            className={[
              "mosaic-cell",
              "mosaic-padding",
              index > 0 ? "mobile-hidden-padding" : "",
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
