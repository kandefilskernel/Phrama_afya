import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const reponse = NextResponse.redirect(new URL(`/admin/connexion?raison=${req.nextUrl.searchParams.get("raison") === "expire" ? "expire" : "sortie"}`, req.url));
  reponse.cookies.delete("nuru_admin");
  return reponse;
}
