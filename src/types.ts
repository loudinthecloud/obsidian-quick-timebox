export interface TimePlanData {
	startTime: string; // "HH:MM"
	endTime: string; // "HH:MM" — if < startTime, wraps past midnight automatically
	granularity: number; // minutes per slot: 15 | 30 | 60 | 120
	entries: Record<string, string>; // "HH:MM" -> entry text
	rtl?: boolean; // force RTL layout
	showNow?: boolean; // whether the current-time indicator is visible (default true)
}

export const GRANULARITY_OPTIONS: { value: number; label: string }[] = [
	{ value: 15, label: "15 minutes" },
	{ value: 30, label: "30 minutes" },
	{ value: 60, label: "1 hour" },
	{ value: 120, label: "2 hours" },
];

export const DEFAULT_TIME_PLAN: Omit<TimePlanData, "entries"> = {
	startTime: "08:00",
	endTime: "23:00",
	granularity: 30,
};

/** Returns end minutes, adding 24h if end ≤ start (midnight wrap). */
export function resolveEndMinutes(startMin: number, endMin: number): number {
	return endMin <= startMin ? endMin + 1440 : endMin;
}
