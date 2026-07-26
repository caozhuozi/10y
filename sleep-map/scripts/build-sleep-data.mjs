import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const sourceDirectory = resolve(process.argv[2] ?? "../data/google-health/sleep");
const outputPath = resolve(process.argv[3] ?? "app/data/sleep-data.json");

const yearDirectories = (await readdir(sourceDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

const sources = await Promise.all(
  yearDirectories.map(async (year) => {
    const sourcePath = join(
      sourceDirectory,
      year,
      `google-health-sleep-${year}.json`,
    );
    return JSON.parse(await readFile(sourcePath, "utf8"));
  }),
);

function offsetMilliseconds(value = "0s") {
  return Number(value.replace(/s$/, "")) * 1000;
}

function localDateTime(instant, offset) {
  return new Date(Date.parse(instant) + offsetMilliseconds(offset))
    .toISOString()
    .slice(0, 16);
}

function intervalMinutes(interval) {
  return (Date.parse(interval.endTime) - Date.parse(interval.startTime)) / 60_000;
}

function asleepMinutes(sleep) {
  const stages = sleep.stages ?? [];
  if (stages.length === 0) return intervalMinutes(sleep.interval);

  const asleepStageTypes = new Set(["ASLEEP", "LIGHT", "DEEP", "REM"]);
  return stages
    .filter((stage) => asleepStageTypes.has(stage.type))
    .reduce(
      (total, stage) =>
        total + (Date.parse(stage.endTime) - Date.parse(stage.startTime)) / 60_000,
      0,
    );
}

const sessionsByDate = new Map();
const seenSessions = new Set();

for (const source of sources) {
  for (const point of source.dataPoints ?? []) {
    const sleep = point.sleep;
    const interval = sleep?.interval;
    if (!interval?.startTime || !interval?.endTime) continue;
    const sessionKey = `${interval.startTime}/${interval.endTime}`;
    if (seenSessions.has(sessionKey)) continue;
    seenSessions.add(sessionKey);

    const wakeDateTime = localDateTime(
      interval.endTime,
      interval.endUtcOffset,
    );
    const date = wakeDateTime.slice(0, 10);
    const duration = asleepMinutes(sleep);
    const session = {
      asleepMinutes: duration,
      bedtime: localDateTime(
        interval.startTime,
        interval.startUtcOffset,
      ).slice(11),
      wakeTime: wakeDateTime.slice(11),
      isNap: sleep.metadata?.nap === true,
      anomaly:
        !Number.isFinite(duration) ||
        duration <= 0 ||
        intervalMinutes(interval) > 24 * 60,
    };

    const sessions = sessionsByDate.get(date) ?? [];
    sessions.push(session);
    sessionsByDate.set(date, sessions);
  }
}

const days = [...sessionsByDate.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([date, sessions]) => {
    const sorted = [...sessions].sort(
      (left, right) => right.asleepMinutes - left.asleepMinutes,
    );
    const mainSessions = sorted.filter((session) => !session.isNap);
    const napSessions = sorted.filter((session) => session.isNap);
    const primary = mainSessions[0] ?? sorted[0];
    const mainMinutes = mainSessions.reduce(
      (total, session) => total + Math.floor(session.asleepMinutes),
      0,
    );
    const napMinutes = napSessions.reduce(
      (total, session) => total + Math.floor(session.asleepMinutes),
      0,
    );
    const totalMinutes = mainMinutes + napMinutes;

    return {
      date,
      mainMinutes,
      napMinutes,
      totalMinutes,
      hasNap: napMinutes > 0,
      sessions: sorted.length,
      anomaly:
        totalMinutes > 18 * 60 || sorted.some((session) => session.anomaly),
      bedtime: primary.bedtime,
      wakeTime: primary.wakeTime,
    };
  });

await writeFile(outputPath, `${JSON.stringify(days, null, 2)}\n`);
console.log(`Generated ${outputPath} with ${days.length} recorded days`);
