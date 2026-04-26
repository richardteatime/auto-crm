import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "activities");

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

    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const ext = path.extname(file.name).toLowerCase();
    const safeName = `${crypto.randomUUID()}${ext}`;
    const filepath = path.join(UPLOAD_DIR, safeName);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    return NextResponse.json({
      name: file.name,
      url: `/uploads/activities/${safeName}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Errore upload: ${error instanceof Error ? error.message : "sconosciuto"}` },
      { status: 500 }
    );
  }
}
