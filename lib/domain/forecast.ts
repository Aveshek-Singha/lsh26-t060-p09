import { addDays, compareDates, diffDays } from "./civilDate";
import { sumPaisa } from "./money";
import type { CivilDate, DueAssessment } from "./types";

export interface ForecastWeek {
  index: number;
  start: CivilDate;
  end: CivilDate;
  items: DueAssessment[];
  count: number;
  valuePaisa: number;
}

export interface Forecast {
  /** Already overdue as of the working date: the backlog to clear first. */
  backlog: { items: DueAssessment[]; count: number; valuePaisa: number };
  weeks: ForecastWeek[];
  busiestIndex: number | null;
  maxCount: number;
}

export const FORECAST_WEEKS = 8;

/**
 * Group upcoming work into week-long buckets so the workshop can see which
 * weeks are heavy before they arrive.
 *
 * Overdue work is kept separate rather than folded into week 1: it is a backlog
 * to clear, not capacity that lands on a particular day.
 */
export function buildForecast(
  assessments: readonly DueAssessment[],
  asOf: CivilDate,
  weekCount: number = FORECAST_WEEKS,
): Forecast {
  const weeks: ForecastWeek[] = Array.from({ length: weekCount }, (_, index) => ({
    index,
    start: addDays(asOf, index * 7),
    end: addDays(asOf, index * 7 + 6),
    items: [],
    count: 0,
    valuePaisa: 0,
  }));

  const backlogItems: DueAssessment[] = [];

  for (const assessment of assessments) {
    if (!assessment.dueDate) continue;

    if (compareDates(assessment.dueDate, asOf) < 0) {
      backlogItems.push(assessment);
      continue;
    }

    const dayOffset = diffDays(asOf, assessment.dueDate);
    const weekIndex = Math.floor(dayOffset / 7);
    const week = weeks[weekIndex];
    if (week) week.items.push(assessment);
  }

  for (const week of weeks) {
    week.count = week.items.length;
    week.valuePaisa = sumPaisa(week.items.map((item) => item.costPaisa));
  }

  const maxCount = weeks.reduce((max, week) => Math.max(max, week.count), 0);
  const busiest = weeks.find((week) => week.count === maxCount && maxCount > 0);

  return {
    backlog: {
      items: backlogItems,
      count: backlogItems.length,
      valuePaisa: sumPaisa(backlogItems.map((item) => item.costPaisa)),
    },
    weeks,
    busiestIndex: busiest?.index ?? null,
    maxCount,
  };
}
