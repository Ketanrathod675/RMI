export const timeAgo = (iso?: string | null): string => {
	if (!iso) return "";
	const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
	const days = Math.floor(hrs / 24);
	if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
	return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
