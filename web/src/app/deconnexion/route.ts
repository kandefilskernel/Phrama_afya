import { NextResponse, type NextRequest } from "next/server";

// Efface la session puis revient à la connexion. Sert quand la session a expiré ou n'est plus valide :
// un cookie ne peut pas être modifié depuis un composant de page, seulement depuis ici ou une action.
export async function GET(req: NextRequest) {
  const reponse = NextResponse.redirect(new URL(`/connexion?raison=${req.nextUrl.searchParams.get("raison") === "expire" ? "expire" : "sortie"}`, req.url));
  reponse.cookies.delete("nuru_acteur");
  return reponse;
}
