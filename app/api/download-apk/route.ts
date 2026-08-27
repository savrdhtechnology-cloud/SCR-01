const APK_SOURCE = "https://github.com/savrdhtechnology-cloud/SCR-01/releases/download/mobile-release-v1.0.11/Savrdh-Credit-Resolution.apk";

export async function GET() {
  const response = await fetch(APK_SOURCE, { redirect: "follow", cache: "no-store" });
  if (!response.ok || !response.body) {
    return new Response("APK is temporarily unavailable.", { status: 502 });
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="Savrdh-Credit-Resolution.apk"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}