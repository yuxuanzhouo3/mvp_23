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

function headerObject(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, rawValue]) => {
      if (typeof rawValue !== "string" || !rawValue.trim()) return [];
      return [[key, rawValue]];
    })
  );
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession();

    const body = await request.json().catch(() => null);
    const fileNameInput = String(body?.fileName || "").trim();
    const contentTypeInput = String(body?.contentType || "").trim();

    if (!fileNameInput) {
      return NextResponse.json({ success: false, error: "请提供文件名" }, { status: 400 });
    }

    const safeFileName = sanitizeFileName(fileNameInput);
    const storagePath = `releases/${safeFileName}`;
    const contentType = contentTypeInput || guessContentType(safeFileName);

    if (getDeploymentRegion() === "CN") {
      const connector = new CloudBaseConnector();
      await connector.initialize();
      const app = connector.getApp();

      const metadataResponse = await app.getUploadMetadata({ cloudPath: storagePath });
      const metadata = metadataResponse?.data || metadataResponse;

      if (!metadata?.url || !metadata?.fileId || !metadata?.token || !metadata?.authorization || !metadata?.cosFileId) {
        return NextResponse.json(
          { success: false, error: "CloudBase 上传元数据获取失败" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        provider: "cloudbase",
        uploadMethod: "PUT",
        uploadUrl: metadata.url,
        uploadHeaders: {
          Signature: metadata.authorization,
          authorization: metadata.authorization,
          "x-cos-security-token": metadata.token,
          "x-cos-meta-fileid": metadata.cosFileId,
          key: encodeURIComponent(storagePath),
          "Content-Type": contentType,
        },
        fileID: metadata.fileId || storagePath,
        fileUrl: metadata.fileId || storagePath,
        fileName: safeFileName,
        storagePath,
        contentType,
      });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage.from("releases").createSignedUploadUrl(storagePath, {
      upsert: true,
    });

    if (error || !data?.signedUrl || !data?.token) {
      return NextResponse.json(
        { success: false, error: error?.message || "Supabase 上传凭证获取失败" },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage.from("releases").getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      provider: "supabase",
      uploadMethod: "PUT",
      uploadUrl: data.signedUrl,
      uploadHeaders: {
        "Content-Type": contentType,
      },
      fileID: storagePath,
      fileUrl: publicUrlData.publicUrl,
      fileName: safeFileName,
      storagePath,
      contentType,
      token: data.token,
    });
  } catch (error: any) {
    console.error("[upload/release/prepare] 上传准备失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "上传准备失败",
      },
      { status: 500 }
    );
  }
}
