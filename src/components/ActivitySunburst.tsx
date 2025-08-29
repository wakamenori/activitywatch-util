"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { CATEGORY_COLORS, getTimeRangeLabel } from "./timeline/timelineUtils";

// Color utilities and helpers (file-scope so hooks don't depend on them)
const adjustColor = (hex: string, amount: number) => {
    const h = hex.replace("#", "");
    const num = Number.parseInt(h, 16);
    let r = (num >> 16) & 0xff;
    let g = (num >> 8) & 0xff;
    let b = num & 0xff;
    const adj = (v: number) => Math.max(0, Math.min(255, Math.round(v + 255 * amount)));
    r = adj(r);
    g = adj(g);
    b = adj(b);
    const toHex = (v: number) => v.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const hexToRgb = (hex: string) => {
    const h = hex.replace("#", "");
    const num = Number.parseInt(h, 16);
    return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff };
};

const rgbToHex = (r: number, g: number, b: number) => {
    const toHex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const hashString = (s: string) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
    return h >>> 0;
};

// HSL helpers for perceptual hue tweaks
const hexToHsl = (hex: string) => {
    const { r, g, b } = hexToRgb(hex);
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        switch (max) {
            case rn:
                h = ((gn - bn) / d) % 6;
                break;
            case gn:
                h = (bn - rn) / d + 2;
                break;
            default:
                h = (rn - gn) / d + 4;
        }
        h *= 60;
        if (h < 0) h += 360;
    }
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return { h, s: s * 100, l: l * 100 };
};

const hslToHex = (h: number, s: number, l: number) => {
    const s1 = s / 100;
    const l1 = l / 100;
    const c = (1 - Math.abs(2 * l1 - 1)) * s1;
    const hh = h / 60;
    const x = c * (1 - Math.abs((hh % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (hh >= 0 && hh < 1) { r = c; g = x; b = 0; }
    else if (hh < 2) { r = x; g = c; b = 0; }
    else if (hh < 3) { r = 0; g = c; b = x; }
    else if (hh < 4) { r = 0; g = x; b = c; }
    else if (hh < 5) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    const m = l1 - c / 2;
    const to255 = (v: number) => Math.round((v + m) * 255);
    return rgbToHex(to255(r), to255(g), to255(b));
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Variant designed to ensure adjacent leaves within a category are distinct
const _variantWithinCategory = (base: string, key: string, indexHint = 0) => {
    const hash = hashString(key);
    const { h, s, l } = hexToHsl(base);
    // Hue shift based on sibling index plus small hash jitter
    const hueShift = (indexHint % 6) * 14 + (hash % 7) - 3; // ~14° steps + jitter
    const satShift = ((indexHint % 3) - 1) * 8; // -8, 0, +8
    const lightShift = indexHint % 2 === 0 ? 10 : -6; // alternate
    const h2 = (h + hueShift + 360) % 360;
    const s2 = clamp(s + satShift, 35, 95);
    const l2 = clamp(l + lightShift, 25, 80);
    return hslToHex(h2, s2, l2);
};

// Dynamic import to avoid SSR issues with Nivo responsive canvas
const ResponsiveSunburst = dynamic(
	() => import("@nivo/sunburst").then((m) => m.ResponsiveSunburst),
	{ ssr: false },
);

type SunburstNode = {
	name: string;
	value?: number;
	children?: SunburstNode[];
};

type ChartNode = SunburstNode & { id: string; color?: string; children?: ChartNode[] };

interface SunburstResponse {
	range: string;
	startTime: string;
	endTime: string;
	root: SunburstNode;
}

export function ActivitySunburst({ timeRange }: { timeRange: string }) {
	const [data, setData] = useState<SunburstResponse | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		async function run() {
			try {
				setLoading(true);
				const res = await fetch(`/api/activity-sunburst?range=${timeRange}`);
				const json: SunburstResponse = await res.json();
				if (!cancelled) setData(json);
			} catch (e) {
				console.error("Failed to fetch sunburst data", e);
				if (!cancelled) setData(null);
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		run();
		return () => {
			cancelled = true;
		};
	}, [timeRange]);

	const totalSeconds = useMemo(() => {
		function sum(n?: SunburstNode): number {
			if (!n) return 0;
			if (n.children && n.children.length > 0)
				return n.children.reduce((s, c) => s + sum(c), 0);
			return n.value || 0;
		}
		return sum(data?.root);
}	, [data]);

	const formatTotal = (s: number) => {
		if (s < 60) return `${Math.round(s)}秒`;
		const m = Math.round(s / 60);
		if (m < 60) return `${m}分`;
		const h = Math.floor(m / 60);
		const mm = m % 60;
		return `${h}時間 ${mm}分`;
	};

	// Build unique ids for all nodes so Nivo doesn't see duplicate keys like "Other"
    const chartRoot = useMemo(() => {
        const countLeaves = (n: SunburstNode): number => {
            if (!n.children || n.children.length === 0) return 1;
            return n.children.reduce((sum, c) => sum + countLeaves(c), 0);
        };
        const build = (
            node: SunburstNode,
            path: string[],
            depth: number,
            catName?: string,
            appName?: string,
            _siblingIndex?: number,
            _siblingCount?: number,
            leafSeq?: { i: number; total: number },
        ): ChartNode => {
            const id = [...path, node.name].join("|");
            // Resolve category/app context
            const nextCat = depth === 0 ? undefined : depth === 1 ? node.name : catName;
            const nextApp = depth === 2 ? node.name : appName;
            const base = nextCat
                ? CATEGORY_COLORS[nextCat as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.Other
                : CATEGORY_COLORS.Other;
            let color: string | undefined;
            const isLeaf = !node.children || node.children.length === 0;
            if (depth === 0) color = "#E5E7EB";
            else if (depth === 1) color = base;
            else if (depth === 2) color = adjustColor(base, 0.15);
            if (isLeaf) {
            const seq = leafSeq ?? { i: 0, total: 1 };
            const pos = seq.total > 1 ? seq.i / (seq.total - 1) : 0; // 0..1 along category
            seq.i++;
            const { h, s, l } = hexToHsl(base);
            const hueSpread = 64; // degrees span within a category
            const h2 = (h - hueSpread / 2 + pos * hueSpread + 360) % 360;
            const l2 = clamp(l + (pos - 0.5) * 12, 28, 82);
            const s2 = clamp(s + Math.cos(pos * Math.PI * 2) * 6, 40, 95);
            color = hslToHex(h2, s2, l2);
            }
        const nextLeafSeq = depth === 1 ? { i: 0, total: countLeaves(node) } : leafSeq; // per-category sequence
        const children = node.children?.map((c, idx, arr) =>
            build(
                c,
                [...path, node.name],
                depth + 1,
                nextCat ?? catName,
                nextApp ?? appName,
                idx,
                arr.length,
                nextLeafSeq,
            ),
        );
        return { ...node, id, color, children } as ChartNode;
        };
        return data?.root ? build(data.root, [], 0, undefined, undefined, 0, 0, undefined) : null;
    }, [data]);


	if (loading) {
		return (
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 h-[420px] flex items-center justify-center">
				<div className="text-gray-500">Loading activity breakdown...</div>
			</div>
		);
	}

	if (!data || !data.root || !data.root.children?.length) {
		return (
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 h-[420px] flex items-center justify-center">
				<div className="text-gray-500">No currentwindow activity in range</div>
			</div>
		);
	}

	// Build legend from categories present
	const categories = (data.root.children || []).map((c) => c.name);
	const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

	return (
		<div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
			<div className="flex items-baseline justify-between mb-4">
				<h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
					直近{getTimeRangeLabel(timeRange)}の利用内訳（サンバースト）
				</h2>
				<span className="text-sm text-gray-500">currentwindow ベース</span>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
				<div className="relative h-[360px] md:col-span-4">
				{/* Center KPI overlay */}
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
					<div className="text-center">
						<div className="text-xl font-semibold dark:text-gray-200">
							{formatTotal(totalSeconds)}
						</div>
						<div className="text-xs text-gray-500">合計アクティブ時間</div>
					</div>
				</div>
				<ResponsiveSunburst
					data={chartRoot as unknown as ChartNode}
					id={(d: unknown) => (d as ChartNode).id}
					value={(d: unknown) => (d as ChartNode).value ?? 0}
					margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
					cornerRadius={2}
					borderWidth={1}
					borderColor={{ from: "color", modifiers: [["darker", 0.6]] }}
					inheritColorFromParent={false}
					colorBy="id"
					colors={(node: unknown) => {
						type NodeLike = { data: ChartNode };
						const n = node as NodeLike;
						return n?.data?.color || CATEGORY_COLORS.Other;
					}}
					animate={true}
					motionConfig="gentle"
					enableArcLabels={true}
					arcLabel={(d: unknown) => {
						const datum = d as {
							percentage?: number;
							data: SunburstNode;
							depth?: number;
						};
						const percent = datum.percentage || 0; // Nivo gives 0..100
						const depth = datum.depth ?? 0;
						if (percent > 12 && depth <= 2 && datum.data.name !== "Other") {
							return truncate(datum.data.name, 14);
						}
						return "";
					}}
					arcLabelsSkipAngle={16}
					arcLabelsTextColor={{ from: "color", modifiers: [["darker", 3]] }}
					tooltip={(args: unknown) => {
						type NodeLike = {
							id: string;
							value: number;
							percentage: number;
							depth: number;
							color: string;
							data: SunburstNode;
							parent?: NodeLike;
						};
						const n = args as NodeLike;
						const parts: string[] = [];
						let p: NodeLike | undefined = n;
						while (p && p.depth > 0) {
							if (p.data?.name) parts.unshift(p.data.name);
							p = p.parent;
						}
						const path = parts.join(" / ");
						return (
							<div className="rounded-md px-2 py-1 text-sm shadow bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600" style={{ color: "inherit" }}>
								<div className="font-medium" style={{ color: n.color }}>
									{path || n.id}
								</div>
								<div className="text-gray-600 dark:text-gray-300">{formatTotal(n.value || 0)}（{Math.round(n.percentage || 0)}%）</div>
								<div className="text-[10px] text-gray-400">{n.depth === 1 ? "カテゴリ" : n.depth === 2 ? "アプリ" : "タイトル"}</div>
							</div>
						);
					}}
				/>
				</div>
				<div className="md:col-span-1">
					<div className="text-sm font-medium mb-2 text-gray-600 dark:text-gray-300">
						カテゴリ
					</div>
					<div className="space-y-2">
						{categories.map((c) => (
							<div key={c} className="flex items-center gap-2 text-sm">
								<span
									className="inline-block w-3 h-3 rounded-sm"
									style={{
										backgroundColor:
											CATEGORY_COLORS[c as keyof typeof CATEGORY_COLORS] ||
											CATEGORY_COLORS.Other,
									}}
								/>
								<span className="text-gray-700 dark:text-gray-200">{c}</span>
							</div>
						))}
					</div>
				</div>
			</div>
			<div className="mt-4 text-xs text-gray-500">
				ラベルは大きいスライス（&gt;12%）のみ表示。詳細はホバーで確認できます。
			</div>
		</div>
	);
}
