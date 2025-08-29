import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function persistXML(activityXML: string): Promise<string | null> {
	try {
		const outDir = join(process.cwd(), "xml");
		await mkdir(outDir, { recursive: true });

		const nowTs = new Date();
		const pad = (n: number) => n.toString().padStart(2, "0");
		const ts = `${nowTs.getFullYear()}${pad(nowTs.getMonth() + 1)}${pad(nowTs.getDate())}-${pad(nowTs.getHours())}${pad(nowTs.getMinutes())}${pad(nowTs.getSeconds())}`;
		const filename = join(outDir, `${ts}.xml`);
		await writeFile(filename, activityXML, { encoding: "utf8" });
		return filename;
	} catch (e) {
		console.error("Failed to write XML file:", e);
		return null;
	}
}
