import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Activity Utils",
	description: "ActivityWatch utilities",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
