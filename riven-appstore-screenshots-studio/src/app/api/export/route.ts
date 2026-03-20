import { mkdir, writeFile } from "fs/promises";
import path from "path";

function safeFilename(input: string) {
  // Keep filenames predictable and prevent directory traversal.
  // Allow only: letters, digits, dash, underscore, dot.
  const cleaned = input.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Ensure it ends with .png
  return cleaned.toLowerCase().endsWith(".png") ? cleaned : `${cleaned}.png`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { filename?: string; dataUrl?: string };
    const filename = body.filename ? safeFilename(body.filename) : null;
    const dataUrl = body.dataUrl;

    if (!filename || !dataUrl) {
      return new Response(JSON.stringify({ error: "Missing filename or dataUrl" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // dataUrl expected: data:image/png;base64,....
    const match = /^data:image\/png;base64,(.*)$/.exec(dataUrl);
    if (!match) {
      return new Response(JSON.stringify({ error: "Invalid PNG dataUrl" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const base64 = match[1]!;
    const buffer = Buffer.from(base64, "base64");

    const outDir = path.join(process.cwd(), "exports");
    await mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, filename);
    await writeFile(outPath, buffer);

    return new Response(JSON.stringify({ ok: true, filename }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Internal export error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

