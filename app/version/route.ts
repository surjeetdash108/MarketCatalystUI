export const dynamic = "force-static";

export async function GET() {
  return Response.json({
    commit: process.env.NEXT_PUBLIC_GIT_COMMIT || "unknown",
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString(),
  });
}
