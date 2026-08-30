import {
  PAISA_PER_VALUE_POINT,
  URGENCY_CAP,
  URGENCY_FLOOR,
  VALUE_CAP,
} from "@/lib/domain/priority";
import { DUE_SOON_DAYS } from "@/lib/domain/due";
import { formatBdt } from "@/lib/domain/money";

/**
 * The brief requires an order that can be explained, so the explanation is on
 * the page rather than buried in a README. Uses <details> so it costs nothing
 * to ship and works without JavaScript.
 */
export function SortExplainer() {
  return (
    <details className="group rounded border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-hi">
        <span
          aria-hidden
          className="text-low transition-transform group-open:rotate-90"
        >
          ›
        </span>
        How this list is ordered
      </summary>
      <div className="border-t border-line px-4 py-4 text-sm text-mid">
        <p className="nums mb-3 rounded bg-raised px-3 py-2 text-xs text-hi">
          score = clamp(days overdue of worst item, {URGENCY_FLOOR}, {URGENCY_CAP}) + min(value of
          due work ÷ {formatBdt(PAISA_PER_VALUE_POINT)}, {VALUE_CAP})
        </p>
        <ul className="space-y-1.5 leading-relaxed">
          <li>
            <strong className="text-hi">Urgency leads.</strong> A vehicle scores the days overdue of
            its worst item. Something 90 days late outranks something due next week.
          </li>
          <li>
            <strong className="text-hi">Money breaks ties.</strong> Every {formatBdt(PAISA_PER_VALUE_POINT)}{" "}
            of work waiting on that vehicle adds one point, so between two equally late vehicles the
            bigger job gets called first.
          </li>
          <li>
            <strong className="text-hi">Value is capped at {VALUE_CAP}.</strong> An expensive job can
            never outrank a badly overdue safety item — brakes before bodywork.
          </li>
          <li>
            <strong className="text-hi">Urgency is floored at {URGENCY_FLOOR}.</strong> Vehicles that
            are only due soon still sort sensibly against each other.
          </li>
          <li>
            A vehicle appears here when any item is overdue or falls due within{" "}
            {DUE_SOON_DAYS} days. Everything else stays off the list.
          </li>
        </ul>
        <p className="mt-3 text-xs text-low">
          Each row shows its own arithmetic, so any position in this list can be checked by hand.
        </p>
      </div>
    </details>
  );
}
