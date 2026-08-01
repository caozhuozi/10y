import sleepData from "./data/sleep-data.json";
import { SleepHeatmap } from "./sleep-heatmap";

const basePath = process.env.PAGES_BASE_PATH ?? "";

export default function Home() {
  return (
    <main className="site-shell">
      <section className="heatmap-stage" aria-label="2026 to 2030 sleep mosaic">
        <SleepHeatmap startYear={2026} endYear={2030} days={sleepData} />
        <a
          className="method-note"
          href={`${basePath}/about-the-data/`}
        >
          about the data
        </a>
      </section>
      <footer className="site-footer">
        <h1 className="site-slogan">sleep is all you need</h1>
        <i className="footer-divider" aria-hidden="true" />
        <span>@Xudong Wang</span>
      </footer>
    </main>
  );
}
