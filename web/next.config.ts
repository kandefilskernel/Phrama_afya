import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie autonome : image Docker légère.
  output: "standalone",
  poweredByHeader: false,
  // Pas de Cache Components : chaque écran dépend de l'utilisateur connecté et de montants à jour,
  // donc rien ne doit être mis en cache entre deux requêtes.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
