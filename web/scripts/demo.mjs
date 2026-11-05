// Lance l'interface web en développement, branchée sur la plateforme de démonstration.
//   npm run demo
// Fonctionne sous Windows, macOS et Linux : les variables d'environnement sont posées ici,
// sans dépendre de la syntaxe du terminal.
// Prérequis : la plateforme de démonstration tourne (npm run demo dans validation-depots).
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const port = process.env.PORT ?? "3100";
const plateforme = process.env.PLATEFORME_URL ?? "http://localhost:3000";

// Le secret doit être le même que celui de la plateforme de démonstration (voir validation-depots/scripts/demo.mjs).
const env = { ...process.env, JETON_BFF: "demo-bff", PLATEFORME_URL: plateforme };

try {
  const reponse = await fetch(`${plateforme}/sante`, { signal: AbortSignal.timeout(3000) });
  if (!reponse.ok) throw new Error(`réponse ${reponse.status}`);
} catch {
  console.error(`La plateforme ne répond pas sur ${plateforme}.`);
  console.error("Lancez-la d'abord, dans un autre terminal : cd validation-depots, puis npm run demo.");
  process.exit(1);
}

console.log(`Interface web sur http://localhost:${port} (plateforme : ${plateforme})`);
const next = require.resolve("next/dist/bin/next");
const enfant = spawn(process.execPath, [next, "dev", "-p", port], { stdio: "inherit", env });
enfant.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => enfant.kill(signal));
