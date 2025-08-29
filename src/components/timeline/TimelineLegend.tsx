interface TimelineLegendItem {
	label: string;
	color: string;
}

interface TimelineLegendProps {
	items: TimelineLegendItem[];
}

export function TimelineLegend({ items }: TimelineLegendProps) {
	if (!items.length) return null;

	return (
		<div className="mt-2 mb-4 flex flex-wrap gap-3">
			{items.map((item) => (
				<div key={item.label} className="flex items-center gap-2 text-sm">
					<span
						className="inline-block w-3 h-3 rounded"
						style={{ backgroundColor: item.color }}
					/>
					<span className="text-gray-700 dark:text-gray-300">{item.label}</span>
				</div>
			))}
		</div>
	);
}
