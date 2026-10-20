import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
const router = httpRouter();
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Disposition",
};
router.route({
  path: "/documents",
  method: "OPTIONS",
  handler: httpAction(
    async () => new Response(null, { status: 204, headers: cors }),
  ),
});
router.route({
  path: "/documents",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const token =
        request.headers.get("Authorization")?.replace(/^Bearer /, "") || "",
      id = new URL(request.url).searchParams.get("id");
    try {
      const access = await ctx.runQuery(internal.bap.fileAccess, { token, id });
      if (!access)
        return new Response("Dokumen tidak ditemukan", {
          status: 404,
          headers: cors,
        });
      const blob = await ctx.storage.get(access.storageId);
      if (!blob)
        return new Response("Dokumen tidak ditemukan", {
          status: 404,
          headers: cors,
        });
      return new Response(blob, {
        headers: {
          ...cors,
          "Content-Type":
            access.format === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="BAP_r${access.revision}.${access.format}"`,
        },
      });
    } catch {
      return new Response(
        "Akses ditolak. Masuk kembali atau periksa akses kelas.",
        { status: 403, headers: { ...cors, "Cache-Control": "no-store" } },
      );
    }
  }),
});
export default router;
