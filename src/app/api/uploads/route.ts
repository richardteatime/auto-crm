import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/appwrite";
import { requireAdmin } from "@/lib/auth";
import { ID } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

export const dynamic = "force-dynamic";

const BUCKET_ID = "uploads";

// Server-side magic-bytes validation so the client cannot spoof MIME types.
function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  const h = buffer.slice(0, 8);
  const hex = h.toString("hex").toLowerCase();

  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (hex.startsWith("89504e47")) return "image/png";
  if (hex.startsWith("47494638")) return "image/gif";
  if (hex.startsWith("52494646") && buffer.length >= 12) {
    const webp = buffer.slice(8, 12).toString("ascii").toLowerCase();
    if (webp === "webp") return "image/webp";
  }
  if (hex.startsWith("25504446")) return "application/pdf";
  if (hex.startsWith("d0cf11e0")) return "application/msword"; // old Word/Excel
  if (hex.startsWith("504b0304")) return "application/zip"; // docx/xlsx
  if (hex.slice(8, 16) === "66747970") return "video/mp4"; // 'ftyp' at offset 4

  // Plain text heuristic: valid UTF-8 and no null bytes in first 512 bytes
  const preview = buffer.slice(0, 512);
  if (!preview.includes(0)) {
    try {
      preview.toString("utf-8");
      return "text/plain";
    } catch {
      // not valid UTF-8
    }
  }

  return null;
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "video/mp4",
  "video/quicktime",
];

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !file.name) {
      return NextResponse.json({ error: "Nessun file ricevuto" }, { status: 400 });
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "File troppo grande (max 20 MB)" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo di file non consentito" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = detectMimeType(buffer);
    if (detected && detected !== file.type) {
      return NextResponse.json(
        { error: "Tipo di file non valido: il contenuto non corrisponde all'estensione" },
        { status: 400 },
      );
    }

    const inputFile = InputFile.fromBuffer(buffer, file.name);

    const uploaded = await storage.createFile(BUCKET_ID, ID.unique(), inputFile);

    // Build public URL via Appwrite endpoint
    const endpoint = (process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "")
      .replace(/\/v1\/?$/, "");
    const url = `${endpoint}/v1/storage/buckets/${BUCKET_ID}/files/${uploaded.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}`;

    return NextResponse.json({
      name: file.name,
      url,
      fileId: uploaded.$id,
    });
  } catch (error) {
    console.error("[UPLOAD ERROR]", error);
    return NextResponse.json(
      { error: "Errore durante l'upload. Riprova più tardi." },
      { status: 500 }
    );
  }
}
