export function formatINR(value: unknown): string {
	if (value === null || value === undefined || value === "") return "-";
	const amount = Number(value);
	if (!Number.isFinite(amount)) return "-";
	return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(amount);
}

export function formatDate(value: unknown): string {
	if (value === null || value === undefined || value === "") return "-";
	const date = value instanceof Date ? value : new Date(value as string | number);
	if (!Number.isFinite(date.getTime())) return "-";
	return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
