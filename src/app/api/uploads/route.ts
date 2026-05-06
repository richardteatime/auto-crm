import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/appwrite";
import { ID } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

export const dynamic = "force-dynamic";

const BUCKET_ID = "uploads";

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
      { error: `Errore upload: ${error instanceof Error ? error.message : "sconosciuto"}` },
      { status: 500 }
    );
  }
}
