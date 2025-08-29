import type { TooltipState } from "./TimelineTypes";
import { detectAppCategory, formatDuration, formatTime } from "./timelineUtils";

interface TimelineTooltipProps {
	tooltip: TooltipState;
	containerWidth: number;
}

export function TimelineTooltip({
	tooltip,
	containerWidth,
}: TimelineTooltipProps) {
	if (!tooltip.visible || !tooltip.event) return null;

	const event = tooltip.event;
	const app = (event.data.app as string) || "";
	const title = (event.data.title as string) || "";
	const status = (event.data.status as string) || "";
	const category = app || title ? detectAppCategory(app, title) : null;

	// Editor-specific fields
	const isEditor = event.bucketType === "app.editor.activity";
	const filePath = (event.data.file as string) || "";
	const language = (event.data.language as string) || "";
	const project = (event.data.project as string) || "";
	const branch = (event.data.branch as string) || "";

	const basename = (p: string) => {
		if (!p) return "";
		const parts = p.split(/[/\\]/);
		return parts[parts.length - 1] || p;
	};

	return (
		<div
			className="absolute z-50 bg-gray-900 text-white text-sm rounded-lg shadow-lg p-3 pointer-events-none max-w-xs"
			style={{
				left: Math.min(tooltip.x + 10, containerWidth - 320),
				top: tooltip.y - 10,
			}}
		>
			<div className="space-y-1">
				<div className="font-semibold text-blue-300">
					{formatTime(event.start)} - {formatTime(event.end)}
				</div>
				<div className="text-gray-300">
					継続時間: {formatDuration(event.duration)}
				</div>
				{/* Editor tooltip content */}
				{isEditor ? (
					<>
						{filePath && (
							<div>
								<span className="text-gray-400">ファイル:</span>{" "}
								{basename(filePath)}
							</div>
						)}
						{project && (
							<div>
								<span className="text-gray-400">プロジェクト:</span>{" "}
								{basename(project) || project}
							</div>
						)}
						{language && (
							<div>
								<span className="text-gray-400">言語:</span> {language}
							</div>
						)}
						{branch && (
							<div>
								<span className="text-gray-400">ブランチ:</span> {branch}
							</div>
						)}
					</>
				) : (
					<>
						{app && (
							<div>
								<span className="text-gray-400">アプリ:</span> {app}
							</div>
						)}
						{category && (
							<div>
								<span className="text-gray-400">カテゴリ:</span> {category}
							</div>
						)}
						{title && (
							<div>
								<span className="text-gray-400">タイトル:</span> {title}
							</div>
						)}
						{status && (
							<div>
								<span className="text-gray-400">状態:</span> {status}
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
