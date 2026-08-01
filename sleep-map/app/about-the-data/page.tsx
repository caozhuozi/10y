import type { Metadata } from "next";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
const basePath = process.env.PAGES_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "a note on the data — sleep is all you need",
  description:
    "How sleep sensed by my Fitbit Inspire 3 becomes one daily tile: wake date, sleep stages, naps, and exclusions.",
  alternates: {
    canonical: `${siteUrl}/about-the-data/`,
  },
};

export default function HowSleepBecomesData() {
  return (
    <main className="methodology-shell">
      <article className="methodology-page">
        <a className="methodology-back" href={`${basePath}/`}>
          ← sleep map
        </a>

        <header className="methodology-header">
          <h1 className="methodology-title">a note on the data</h1>
        </header>

        <div className="methodology-copy">
          <p>
            My sleep is sensed by a Fitbit Inspire 3 and carried into this map
            through the Google Health API. The bedtime–wake time comes from my
            longest main sleep session ending that day, using its local start
            and end times. My displayed sleep adds ASLEEP, LIGHT, DEEP, and REM
            from every main sleep session and nap ending on that date, so a
            night crossing midnight belongs to the day I wake up. I leave out
            AWAKE and duplicate intervals; when no stage data exists, I use the
            full session interval instead.
          </p>
        </div>
      </article>
    </main>
  );
}
