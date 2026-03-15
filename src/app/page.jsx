import { CartDrawer } from "@/components/CartDrawer";
import { Hero } from "@/components/Hero";
import { ProblemSolution } from "@/components/ProblemSolution";
import { FeaturedProduct } from "@/components/FeaturedProduct";
import { Packs } from "@/components/Packs";
import { Testimonials } from "@/components/Testimonials";
import { Upsell } from "@/components/Upsell";
import { FAQ } from "@/components/FAQ";
import { Footer } from "@/components/Footer";
import {Navbar} from "@/components/Navbar";
import AdvertisingTape from "@/components/AdvertisingTape";
import UTMStore from "@/components/UTMStore";
import PackBridge from "@/components/PackBridge/PackBridge";
import ShippingInfo from "@/components/ShippingInfo";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import PaymentRecovery from "@/components/PaymentRecovery";

export default function Page() {

  const productSchema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "Organizador Acrílico Hermético 1100 ml",
    "image": [
      "https://ordenatodoensulugar.com.ar//img/contenedor-acrilico-1100ml.webp"
    ],
    "description": "Contenedor hermético ideal para organizar alacena, cocina o heladera.",
    "brand": {
      "@type": "Brand",
      "name": "ORDENA"
    },
    "offers": {
      "@type": "Offer",
      "url": "https://ordenatodoensulugar.com.ar",
      "priceCurrency": "ARS",
      "price": "7999",
      "availability": "https://schema.org/InStock"
    }
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <ScrollToTopButton />
      <WhatsAppFloat/>
      <UTMStore/>
      <PaymentRecovery/>
      <AdvertisingTape/>
      <Navbar/>
      <CartDrawer />
      <Hero />
      <ProblemSolution />
      <PackBridge targetId="packs" />
      <Packs />
      <FeaturedProduct />
      <ShippingInfo />
      <Testimonials />
      <Upsell />
      <FAQ />
      <Footer />
    </main>
  );
}
