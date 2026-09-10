import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PetCamp — Promoções",
    short_name: "PetCamp",
    description: "Gestão de promoções e verificações da equipe PetCamp",
    start_url: "/painel",
    display: "standalone",
    orientation: "portrait",
    background_color: "#3D1C87",
    theme_color: "#3D1C87",
    icons: [
      { src: "/petcamp-logo.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/petcamp-logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/petcamp-logo.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
