export function parseDateInput(input: string | null | undefined): Date | null {
	if (!input) return null;
	const trimmed = input.trim();
	if (trimmed.length === 0) return null;

	if (/^\d+$/.test(trimmed)) {
		const numeric = Number.parseInt(trimmed, 10);
		const ms = trimmed.length <= 10 ? numeric * 1000 : numeric;
		const candidate = new Date(ms);
		return Number.isNaN(candidate.getTime()) ? null : candidate;
	}

	const normalized = trimmed.replace(" ", "T");
	const candidate = new Date(normalized);
	return Number.isNaN(candidate.getTime()) ? null : candidate;
}

export function formatRangeLabel(start: Date, end: Date): string {
	const diffMs = Math.max(0, end.getTime() - start.getTime());
	const totalMinutes = Math.round(diffMs / 60000);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours > 0) {
		return `${hours}時間${minutes > 0 ? `${minutes}分` : ""}`;
	}
	return `${minutes}分`;
}
