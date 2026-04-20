import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { getAdminDatabase } from "../lib/admin/database";
import { CloudBaseConnector } from "../lib/cloudbase/connector";
import { getSupabaseAdmin } from "../lib/integrations/supabase-admin";
import type { Platform } from "../lib/admin/types";

type ReleaseProvider = "cloudbase" | "supabase";

interface PackageSpec {
  label: string;
  platform: Platform;
  version: string;
  sourcePath: string;
  releaseNotes: string;
}

interface UploadedAsset {
  fileUrl: string;
  fileName: string;
  fileSize: number;
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function guessMimeType(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "apk":
      return "application/vnd.android.package-archive";
    case "aab":
      return "application/octet-stream";
    case "ipa":
      return "application/octet-stream";
    case "exe":
      return "application/x-msdownload";
    case "dmg":
      return "application/x-apple-diskimage";
    case "deb":
      return "application/vnd.debian.binary-package";
    case "rpm":
      return "application/x-rpm";
    case "zip":
      return "application/zip";
    case "hap":
      return "application/octet-stream";
    case "crx":
      return "application/x-chrome-extension";
    default:
      return "application/octet-stream";
  }
}

async function ensureFile(filePath: string) {
  await access(filePath);
}

function createChromeExtensionZip(): string {
  const sourceDir = "/mnt/d/william/projects/mornscience/chrome-extension/googleplugin";
  const outputDir = path.join(os.tmpdir(), "mornstack-release-assets");
  const zipPath = path.join(outputDir, "googleplugin.zip");
  execFileSync("mkdir", ["-p", outputDir]);
  try {
    execFileSync("zip", ["-r", "-q", zipPath, "."], {
      cwd: sourceDir,
    });
  } catch {
    const pythonCode = [
      "import pathlib, sys, zipfile",
      "source = pathlib.Path(sys.argv[1])",
      "target = pathlib.Path(sys.argv[2])",
      "with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as zf:",
      "    for path in source.rglob('*'):",
      "        if path.is_file() and path.name != '.DS_Store':",
      "            zf.write(path, path.relative_to(source))",
    ].join("\n");
    execFileSync("python3", ["-c", pythonCode, sourceDir, zipPath]);
  }
  return zipPath;
}

async function uploadToCloudBase(filePath: string, targetName: string): Promise<UploadedAsset> {
  const connector = new CloudBaseConnector();
  await connector.initialize();
  const app = connector.getApp();
  const bytes = Buffer.from(await readFile(filePath));
  const upload = await app.uploadFile({
    cloudPath: `releases/${targetName}`,
    fileContent: bytes,
  });

  const fileID = upload?.fileID || `releases/${targetName}`;
  return {
    fileUrl: fileID,
    fileName: targetName,
    fileSize: bytes.byteLength,
  };
}

async function uploadToSupabase(filePath: string, targetName: string): Promise<UploadedAsset> {
  const supabase = getSupabaseAdmin();
  const bytes = Buffer.from(await readFile(filePath));
  const { error } = await supabase.storage
    .from("releases")
    .upload(targetName, bytes, {
      upsert: true,
      contentType: guessMimeType(targetName),
    });

  if (error) {
    throw new Error(`Supabase 上传失败: ${error.message}`);
  }

  const { data } = supabase.storage.from("releases").getPublicUrl(targetName);
  return {
    fileUrl: data.publicUrl,
    fileName: targetName,
    fileSize: bytes.byteLength,
  };
}

async function upsertRelease(provider: ReleaseProvider, spec: PackageSpec, uploaded: UploadedAsset) {
  const adapter = getAdminDatabase(provider);
  const existing = await adapter.listReleases();
  const duplicate = existing.filter(
    (release) =>
      release.file_name === uploaded.fileName ||
      (release.version === spec.version && release.platform === spec.platform)
  );

  for (const item of duplicate) {
    await adapter.deleteRelease(item.id).catch(() => null);
  }

  return adapter.createRelease({
    version: spec.version,
    platform: spec.platform,
    title: spec.label,
    file_url: uploaded.fileUrl,
    file_name: uploaded.fileName,
    file_size: uploaded.fileSize,
    release_notes: spec.releaseNotes,
    is_active: true,
    is_mandatory: false,
    variant: undefined,
  });
}

async function main() {
  const releaseVersion = "2026.04.20";
  const extensionZip = createChromeExtensionZip();

  const baseDir = "/mnt/d/william/projects/mornscience/acceptance_delivery_20260419/acceptance_delivery_20260419";
  const packages: PackageSpec[] = [
    {
      label: "国内 Android",
      platform: "android",
      version: `${releaseVersion}-android-cn`,
      sourcePath: path.join(baseDir, "03_android_domestic/release/Mornstack-domestic-release.apk"),
      releaseNotes: "国内 Android 发布包，包含手机验证码登录、支付宝支付和微信支付。",
    },
    {
      label: "国际 Android",
      platform: "android",
      version: `${releaseVersion}-android-intl`,
      sourcePath: path.join(baseDir, "04_android_intl/release/Mornscience-intl-release.apk"),
      releaseNotes: "国际 Android 发布包，包含 Google 登录、PayPal 和 Stripe。",
    },
    {
      label: "鸿蒙",
      platform: "harmony",
      version: `${releaseVersion}-harmony`,
      sourcePath: path.join(baseDir, "05_harmony/release/hap-release.hap"),
      releaseNotes: "鸿蒙发布包。",
    },
    {
      label: "iOS",
      platform: "ios",
      version: `${releaseVersion}-ios`,
      sourcePath: path.join(baseDir, "08_ios_and_download/ios/ipa-release.ipa"),
      releaseNotes: "iOS 发布包。",
    },
    {
      label: "桌面端",
      platform: "desktop",
      version: `${releaseVersion}-desktop`,
      sourcePath: path.join(baseDir, "08_ios_and_download/desktop/mornstack.exe"),
      releaseNotes: "桌面端发布包。",
    },
    {
      label: "Chrome Extension",
      platform: "extension",
      version: `${releaseVersion}-extension`,
      sourcePath: extensionZip,
      releaseNotes: "Chrome 扩展发布包。",
    },
  ];

  for (const spec of packages) {
    await ensureFile(spec.sourcePath);
    const fileName = safeName(path.basename(spec.sourcePath));
    for (const provider of ["cloudbase", "supabase"] as const) {
      const providerLabel = provider === "cloudbase" ? "CloudBase" : "Supabase";
      console.log(`\n[${providerLabel}] 上传 ${spec.label}: ${fileName}`);

      const uploaded =
        provider === "cloudbase"
          ? await uploadToCloudBase(spec.sourcePath, fileName)
          : await uploadToSupabase(spec.sourcePath, fileName);

      const release = await upsertRelease(provider, spec, uploaded);
      console.log(`✓ ${spec.label} 已写入 ${providerLabel} releases:`, {
        id: release.id,
        version: release.version,
        platform: release.platform,
        fileName: release.file_name,
      });
    }
  }

  console.log("\n全部安装包已同步到对应后台。");
}

main().catch((error) => {
  console.error("上传失败:", error);
  process.exit(1);
});
