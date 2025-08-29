"use client";

import { useCompletion } from "@ai-sdk/react";
import { useState } from "react";

interface ActivityAnalysisProps {
	timeRange?: string;
}

export function ActivityAnalysis({ timeRange = "60m" }: ActivityAnalysisProps) {
	const [lastAnalysis, setLastAnalysis] = useState<Date | null>(null);

	const { complete, completion, isLoading, error } = useCompletion({
		api: `/api/analyze-activity?range=${timeRange}&provider=gemini`,
	});

	const getTimeRangeLabel = (range: string): string => {
		switch (range) {
			case "30m":
				return "30分";
			case "60m":
				return "1時間";
			case "120m":
				return "2時間";
			default:
				return "1時間";
		}
	};

	const handleAnalyze = async () => {
		try {
			await complete("");
			setLastAnalysis(new Date());
		} catch (err) {
			console.error("Analysis failed:", err);
		}
	};

	const formatAnalysisTime = (date: Date) => {
		return date.toLocaleTimeString("ja-JP", {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mt-6">
			<div className="flex justify-between items-center mb-4">
				<div className="flex items-center gap-3">
					<h3 className="text-xl font-bold text-gray-900 dark:text-white">
						AI活動分析
					</h3>
					{lastAnalysis && (
						<span className="text-sm text-gray-500 dark:text-gray-400">
							最終分析: {formatAnalysisTime(lastAnalysis)}
						</span>
					)}
				</div>
				<button
					type="button"
					onClick={handleAnalyze}
					disabled={isLoading}
					className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
				>
					{isLoading ? (
						<>
							<svg
								className="animate-spin h-4 w-4"
								viewBox="0 0 24 24"
								aria-label="読み込み中"
								role="img"
							>
								<circle
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
									fill="none"
									className="opacity-25"
								/>
								<path
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									fill="currentColor"
									className="opacity-75"
								/>
							</svg>
							分析中...
						</>
					) : (
						"活動を分析"
					)}
				</button>
			</div>

			<div className="relative">
				{error && (
					<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
						<div className="flex">
							<div className="flex-shrink-0">
								<svg
									className="h-5 w-5 text-red-400"
									viewBox="0 0 20 20"
									fill="currentColor"
									aria-label="エラー"
									role="img"
								>
									<path
										fillRule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
										clipRule="evenodd"
									/>
								</svg>
							</div>
							<div className="ml-3">
								<h4 className="text-sm font-medium text-red-800 dark:text-red-300">
									分析エラー
								</h4>
								<div className="mt-2 text-sm text-red-700 dark:text-red-400">
									活動データの分析に失敗しました。しばらくしてから再試行してください。
								</div>
							</div>
						</div>
					</div>
				)}

				{isLoading && !completion && (
					<div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
						<div className="flex items-center gap-3">
							<div className="flex space-x-2">
								<div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
								<div
									className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
									style={{ animationDelay: "0.1s" }}
								/>
								<div
									className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
									style={{ animationDelay: "0.2s" }}
								/>
							</div>
							<span className="text-gray-600 dark:text-gray-400">
								アクティビティデータを分析しています...
							</span>
						</div>
					</div>
				)}

				{(completion || (isLoading && completion)) && (
					<div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
						<div className="prose prose-gray dark:prose-invert max-w-none">
							<div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
								{completion}
								{isLoading && (
									<span className="inline-block w-2 h-5 bg-blue-500 ml-1 animate-pulse" />
								)}
							</div>
						</div>
					</div>
				)}

				{!completion && !isLoading && !error && (
					<div className="text-center py-8 text-gray-500 dark:text-gray-400">
						<div className="mb-2">
							<svg
								className="w-12 h-12 mx-auto opacity-50"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-label="情報"
								role="img"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						</div>
						<p>
							「活動を分析」ボタンをクリックして、直近
							{getTimeRangeLabel(timeRange)}
							の活動パターンのAI分析を開始してください。
						</p>
					</div>
				)}
			</div>

			{completion && (
				<div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
					<p className="text-xs text-gray-500 dark:text-gray-400">
						💡 この分析は直近{getTimeRangeLabel(timeRange)}
						のActivityWatchデータに基づいています。より正確な分析のため、定期的に実行することをお勧めします。
					</p>
				</div>
			)}
		</div>
	);
}
