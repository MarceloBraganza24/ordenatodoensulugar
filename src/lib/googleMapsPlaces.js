let googleBootstrapPromise = null;

export async function loadGooglePlacesLibrary() {
  if (typeof window === "undefined") {
    throw new Error("Google Maps solo puede cargarse en el navegador.");
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en tus variables de entorno."
    );
  }

  if (!googleBootstrapPromise) {
    googleBootstrapPromise = new Promise((resolve, reject) => {
      try {
        // Si ya existe importLibrary, no volvemos a bootstrapppear
        if (window.google?.maps?.importLibrary) {
          resolve(window.google.maps);
          return;
        }

        // Bootstrap loader oficial de Google adaptado a JS normal
        (g => {
          let h, a, k;
          const p = "The Google Maps JavaScript API";
          const c = "google";
          const l = "importLibrary";
          const q = "__ib__";
          const m = document;
          let b = window;

          b = b[c] || (b[c] = {});
          const d = b.maps || (b.maps = {});
          const r = new Set();
          const e = new URLSearchParams();

          const u = () =>
            h ||
            (h = new Promise(async (f, n) => {
              a = m.createElement("script");

              e.set("libraries", [...r] + "");
              for (k in g) {
                e.set(
                  k.replace(/[A-Z]/g, (t) => "_" + t[0].toLowerCase()),
                  g[k]
                );
              }

              e.set("callback", c + ".maps." + q);

              a.src = `https://maps.${c}apis.com/maps/api/js?` + e.toString();
              d[q] = f;

              a.onerror = () => {
                reject(new Error(p + " could not load."));
              };

              a.nonce = m.querySelector("script[nonce]")?.nonce || "";
              m.head.append(a);
            }));

          if (d[l]) {
            resolve(d);
            return;
          }

          d[l] = (f, ...n) => {
            r.add(f);
            return u().then(() => d[l](f, ...n));
          };
        })({
          key: apiKey,
          v: "weekly",
          language: "es",
          region: "AR",
        });

        if (!window.google?.maps?.importLibrary) {
          reject(new Error("Google Maps bootstrap no inicializó importLibrary."));
          return;
        }

        resolve(window.google.maps);
      } catch (err) {
        reject(err);
      }
    });
  }

  const maps = await googleBootstrapPromise;
  return maps.importLibrary("places");
}