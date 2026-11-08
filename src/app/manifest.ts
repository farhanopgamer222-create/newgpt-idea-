import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "FarhanGPT — Your personal AI", short_name: "FarhanGPT", description: "A little curiosity. Endless possibilities. Your AI companion, wherever you go.", start_url: "/", scope: "/", display: "standalone", background_color: "#0b0b10", theme_color: "#0b0b10", orientation: "any", categories: ["productivity", "education"], icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }, { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] };
}
