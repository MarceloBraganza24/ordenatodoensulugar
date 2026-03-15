import "@/styles/globals.scss";
import { CartProvider } from "@/context/CartContext";
import { Suspense } from "react";
import PortalAutoClaim from "@/components/PortalAutoClaim";
import MetaPixel from "@/components/MetaPixel";
import PageViewTracker from "@/components/PageViewTracker";
import MetaPageViewTracker from "@/components/MetaPageViewTracker";

export const metadata = {
  title: {
    default: "Organizadores de cocina en Argentina | ORDENA todo en su lugar",
    template: "%s | ORDENA",
  },
  description:
    "Organizadores de cocina en Argentina. Contenedores herméticos, cubierteros de bambú y soluciones para ordenar tu alacena y cajones. Envíos a todo el país.",

  keywords: [
    "organizadores de cocina",
    "contenedores herméticos",
    "cubierteros de bambú",
    "orden cocina",
    "organizadores alacena",
    "organizar cocina argentina",
  ],

  alternates: {
    canonical: "https://ordenatodoensulugar.com.ar",
  },

  openGraph: {
    title: "Organizadores de cocina en Argentina | ORDENA",
    description:
      "Contenedores herméticos, cubierteros de bambú y soluciones para ordenar tu cocina.",
    url: "https://ordenatodoensulugar.com.ar",
    siteName: "ORDENA",
    images: [
      {
        url: "https://ordenatodoensulugar.com.ar/img/contenedor-acrilico-1100ml.webp",
        width: 1200,
        height: 630,
      },
    ],
    locale: "es_AR",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <meta
          name="facebook-domain-verification"
          content="lhtujxinl71pgt7grhyf5oyr7tdrrn3"
        />
      </head>
      <body>
        <CartProvider>
          <MetaPixel />

          <Suspense fallback={null}>
            <MetaPageViewTracker />
          </Suspense>

          <Suspense fallback={null}>
            <PageViewTracker />
          </Suspense>

          <PortalAutoClaim />
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
