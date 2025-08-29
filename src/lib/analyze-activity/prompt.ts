import { formatDuration } from "./format";
import { formatKVList, type Stats, topN } from "./stats";

export function buildHumanSummary(stats: Stats): string {
	const topApps = formatKVList(topN(stats.byApp, 3));
	const topCats = formatKVList(topN(stats.byCategory, 3));
	const topDomains = formatKVList(topN(stats.byDomain, 3));
	const topProjects = formatKVList(topN(stats.byProject, 3));
	const focusCat = stats.longestFocus.category
		? `${stats.longestFocus.category.label} ${formatDuration(stats.longestFocus.category.seconds)}`
		: "-";
	const switchesLine = `切替: カテゴリ ${stats.switches.category}回 / アプリ ${stats.switches.app}回 (10分あたり ${stats.switchDensityPer10m.toFixed(1)})`;

	return [
		`総アクティブ ${formatDuration(stats.totalSeconds)}（上位カテゴリ: ${topCats}）`,
		`上位アプリ: ${topApps}`,
		`プロジェクト: ${topProjects}`,
		`ドメイン: ${topDomains}`,
		`最長フォーカス: ${focusCat}`,
		switchesLine,
		stats.localDevSeconds > 0
			? `ローカル開発: ${formatDuration(stats.localDevSeconds)}`
			: "",
	]
		.filter(Boolean)
		.join("\n");
}

export function buildPrompt(params: {
	start: Date;
	end: Date;
	timeRangeLabel: string;
	humanSummary: string;
	activityXML: string;
}): string {
	const { start, end, timeRangeLabel, humanSummary, activityXML } = params;
	return `あなたは生産性アドバイザーです。以下のXML形式のアクティビティデータと統計サマリを分析して、日本語で簡潔な要約とアドバイスを提供してください。

データ期間: ${start.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} ～ ${end.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} (JST)
時間範囲: ${timeRangeLabel}

統計サマリ:
${humanSummary}

アクティビティデータ（XML形式）:
${activityXML}

以下の観点から300文字程度で分析してください:
1. この${timeRangeLabel}の活動パターンの特徴（時系列での作業の流れ）
2. 生産性に関する気づき（集中度、効率性など）
3. 改善提案（具体的で実行可能なもの）

時間は既にJST形式で表示されており、durationは人間が読みやすい形式（例：10m12s）で表示されています。
親しみやすく、建設的なトーンでお願いします。`;
}
