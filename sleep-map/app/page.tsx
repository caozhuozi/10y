import sleepData from "./data/sleep-data.json";
import { SleepHeatmap } from "./sleep-heatmap";

export default function Home() {
  return (
    <main className="site-shell">
      <section className="heatmap-stage" aria-label="2026 to 2030 sleep mosaic">
        <SleepHeatmap startYear={2026} endYear={2030} days={sleepData} />
        <h1 className="site-slogan">sleep is all you need</h1>
        <p className="site-description">
          A personal sleep heatmap, one day at a time, from 2026 to 2030.
        </p>
      </section>
      <footer className="site-footer">@Xudong Wang</footer>
    </main>
  );
}
