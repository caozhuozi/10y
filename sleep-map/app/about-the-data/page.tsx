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

        <p className="methodology-flow">
          Fitbit Inspire 3 → Google Health API → this map
        </p>

        <div className="methodology-copy">
          <p>
            Main sleep is the sum of ASLEEP, LIGHT, DEEP, and REM. The time
            shown is the local start and end of my longest main session. AWAKE
            and duplicate intervals are excluded.
          </p>
          <p>
            I file each sleep under the date it ends. Naps stay separate in the
            detail, but join main sleep in the daily average and tile color.
          </p>
        </div>

        <div className="methodology-colors">
          <p className="color-scale-label">daily total</p>
          <div className="color-scale" aria-label="Sleep duration color scale">
            {[
              ["level-1", "<6h"],
              ["level-2", "6–7h"],
              ["level-3", "7–8h"],
              ["level-4", "8–9h"],
              ["level-5", ">9h"],
            ].map(([level, label]) => (
              <span key={level}>
                <i className={level} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </article>
    </main>
  );
}
