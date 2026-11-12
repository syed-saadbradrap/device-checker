import path from "node:path";
import fs from "node:fs/promises";
import { screenshotDir } from "@/lib/browser/playwright";
import { jsonError, publicErrorMessage } from "@/lib/api/http";

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const relative = searchParams.get("path");
    if (!relative || !relative.trim()) {
      return jsonError("path query parameter is required", 400);
    }

    // Reject absolute paths and traversal segments early
    if (
      path.isAbsolute(relative) ||
      relative.includes("\0") ||
      relative.split(/[/\\]/).some((seg) => seg === "..")
    ) {
      return jsonError("Invalid path", 400);
    }

    const root = path.resolve(screenshotDir());
    const resolved = path.resolve(root, relative);

    const relativeToRoot = path.relative(root, resolved);
    if (
      relativeToRoot.startsWith("..") ||
      path.isAbsolute(relativeToRoot) ||
      resolved === root
    ) {
      return jsonError("Path is outside the screenshot directory", 400);
    }

    let data: Buffer;
    try {
      data = await fs.readFile(resolved);
    } catch {
      return jsonError("File not found", 404);
    }

    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(resolved),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return jsonError(publicErrorMessage(e, "Failed to serve screenshot"), 500);
  }
}
