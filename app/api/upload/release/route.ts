import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/session";
import { getDeploymentRegion } from "@/config";
import { CloudBaseConnector } from "@/lib/cloudbase/connector";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

function sanitizeFileName(name: string) {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return safe || "release.bin";
}

function guessContentType(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    apk: "application/vnd.android.package-archive",
    aab: "application/octet-stream",
    ipa: "application/octet-stream",
    exe: "application/x-msdownload",
    dmg: "application/x-apple-diskimage",
    deb: "application/vnd.debian.binary-package",
    rpm: "application/x-rpm",
    zip: "application/zip",
    hap: "application/octet-stream",
    crx: "application/x-chrome-extension",
  };
  return (ext && map[ext]) || "application/octet-stream";
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession();

    const formData = await request.formData();
    const file = formData.get("file");
    const fileNameInput = String(formData.get("fileName") || "").trim();

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ success: false, error: "请先选择要上传的安装包" }, { status: 400 });
    }

    const safeFileName = sanitizeFileName(fileNameInput || file.name || "release.bin");
    const storagePath = `releases/${safeFileName}`;
    const contentType = file.type || guessContentType(safeFileName);
    const bytes = Buffer.from(await file.arrayBuffer());

    if (getDeploymentRegion() === "CN") {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const app = connector.getApp();

      const uploadResult = await app.uploadFile({
        cloudPath: storagePath,
        fileContent: bytes,
      });

      const fileID = uploadResult?.fileID || storagePath;
      return NextResponse.json({
        success: true,
        fileID,
        fileUrl: fileID,
        fileName: safeFileName,
        fileSize: file.size,
        contentType,
      });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage
      .from("releases")
      .upload(safeFileName, bytes, {
        upsert: true,
        contentType,
      });

    if (error) {
      return NextResponse.json({ success: false, error: `上传失败: ${error.message}` }, { status: 500 });
    }

    const { data } = supabase.storage.from("releases").getPublicUrl(safeFileName);

    return NextResponse.json({
      success: true,
      fileID: data.publicUrl,
      fileUrl: data.publicUrl,
      fileName: safeFileName,
      fileSize: file.size,
      contentType,
    });
  } catch (error: any) {
    console.error("[upload/release] 上传失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "上传失败",
      },
      { status: 500 }
    );
  }
}
