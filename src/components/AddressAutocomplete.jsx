"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadGooglePlacesLibrary } from "@/lib/googleMapsPlaces";

const PROVINCE_CODE_BY_NAME = {
  "buenos aires": "B",
  "buenos aires province": "B",
  "provincia de buenos aires": "B",

  "caba": "C",
  "ciudad autonoma de buenos aires": "C",
  "capital federal": "C",
  "autonomous city of buenos aires": "C",

  "catamarca": "K",
  "chaco": "H",
  "chubut": "U",
  "cordoba": "X",
  "córdoba": "X",
  "corrientes": "W",
  "entre rios": "E",
  "entre ríos": "E",
  "formosa": "P",
  "jujuy": "Y",
  "la pampa": "L",
  "la rioja": "F",
  "mendoza": "M",
  "misiones": "N",
  "neuquen": "Q",
  "neuquén": "Q",
  "rio negro": "R",
  "río negro": "R",
  "salta": "A",
  "san juan": "J",
  "san luis": "D",
  "santa cruz": "Z",
  "santa fe": "S",
  "santiago del estero": "G",
  "tierra del fuego": "V",
  "tierra del fuego, antartida e islas del atlantico sur": "V",
  "tierra del fuego, antártida e islas del atlántico sur": "V",
  "tucuman": "T",
  "tucumán": "T",
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getAddressComponent(components, type) {
  if (!Array.isArray(components)) return null;
  return components.find((c) => Array.isArray(c.types) && c.types.includes(type)) || null;
}

function mapProvinceToCode(longText, shortText) {
  const longKey = normalizeText(longText);
  const shortKey = normalizeText(shortText);

  if (PROVINCE_CODE_BY_NAME[longKey]) return PROVINCE_CODE_BY_NAME[longKey];
  if (PROVINCE_CODE_BY_NAME[shortKey]) return PROVINCE_CODE_BY_NAME[shortKey];

  // fallback por contains
  if (longKey.includes("buenos aires")) return "B";
  if (longKey.includes("capital federal")) return "C";
  if (longKey.includes("ciudad autonoma de buenos aires")) return "C";
  if (longKey.includes("autonomous city of buenos aires")) return "C";
  if (longKey.includes("cordoba")) return "X";
  if (longKey.includes("entre rios")) return "E";
  if (longKey.includes("neuquen")) return "Q";
  if (longKey.includes("rio negro")) return "R";
  if (longKey.includes("tucuman")) return "T";

  return "";
}

function parseGoogleAddress(place) {
  const components = place.addressComponents || [];


  const route = getAddressComponent(components, "route");
  const streetNumber = getAddressComponent(components, "street_number");
  const locality = getAddressComponent(components, "locality");
  const postalTown = getAddressComponent(components, "postal_town");
  const adminArea2 = getAddressComponent(
    components,
    "administrative_area_level_2"
  );
  const sublocality = getAddressComponent(components, "sublocality_level_1");
  const adminArea1 = getAddressComponent(
    components,
    "administrative_area_level_1"
  );
  const postalCode = getAddressComponent(components, "postal_code");

  const city =
    locality?.longText ||
    postalTown?.longText ||
    adminArea2?.longText ||
    sublocality?.longText ||
    "";

  const provinceName = adminArea1?.longText || "";
  const provinceShort = adminArea1?.shortText || "";
  const provinceCode = mapProvinceToCode(provinceName, provinceShort);

  // Si Google devolvió calle completa en route y no separó número,
  // intentamos partirla al final.
  let finalStreetName = route?.longText || "";
  let finalStreetNumber = streetNumber?.longText || "";

  if (!finalStreetNumber && finalStreetName) {
    const match = finalStreetName.match(/^(.*?)[,\s]+(\d+[A-Za-z\-\/]*)$/);
    if (match) {
      finalStreetName = match[1].trim();
      finalStreetNumber = match[2].trim();
    }
  }

  return {
    formattedAddress: place.formattedAddress || "",
    streetName: finalStreetName,
    streetNumber: finalStreetNumber,
    city,
    provinceName,
    provinceCode,
    postalCode: postalCode?.longText || "",
    googlePlaceId: place.id || "",
  };
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelectAddress,
  placeholder = "Empezá a escribir tu dirección",
  disabled = false,
}) {
  const [ready, setReady] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const placesLibRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);
  const rootRef = useRef(null);

  const hasText = useMemo(() => String(value || "").trim().length >= 3, [value]);

  useEffect(() => {
    let mounted = true;

    async function init() {
        try {
        const placesLib = await loadGooglePlacesLibrary();
        if (!mounted) return;


        placesLibRef.current = placesLib;

        if (placesLib?.AutocompleteSessionToken) {
            sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        } else {
            console.warn(
            "[AddressAutocomplete] NO existe AutocompleteSessionToken"
            );
        }

        setReady(true);
        } catch (err) {
        console.error("[AddressAutocomplete] error init:", err);
        if (!mounted) return;
        setLocalError("No pudimos cargar el autocompletado de direcciones.");
        }
    }

    init();

    return () => {
        mounted = false;
    };
    }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const placesLib = await loadGooglePlacesLibrary();
        if (!mounted) return;

        placesLibRef.current = placesLib;
        if (placesLib?.AutocompleteSessionToken) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        setReady(true);
      } catch (err) {
        if (!mounted) return;
        setLocalError("No pudimos cargar el autocompletado de direcciones.");
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!ready || !hasText || disabled) {
      setSuggestions([]);
      setIsOpen(false);
      setLoading(false);
      return;
    }

    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const currentReqId = ++requestIdRef.current;
      setLoading(true);
      setLocalError("");

      try {
        const placesLib = placesLibRef.current;
        const { AutocompleteSuggestion, AutocompleteSessionToken } = placesLib;

        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }

        const request = {
          input: value,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ["AR"],
          language: "es",
          region: "AR",
        };

        const { suggestions: nextSuggestions = [] } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

        if (currentReqId !== requestIdRef.current) return;

        setSuggestions(nextSuggestions);
        setIsOpen(nextSuggestions.length > 0);
        setActiveIndex(-1);
      } catch (err) {
        if (currentReqId !== requestIdRef.current) return;
        setSuggestions([]);
        setIsOpen(false);
        setLocalError("No pudimos sugerir direcciones ahora.");
      } finally {
        if (currentReqId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [value, ready, hasText, disabled]);

  const selectSuggestion = async (suggestion) => {
    try {
      setLoading(true);
      setLocalError("");

      const prediction = suggestion?.placePrediction;
      if (!prediction) return;

      const place = prediction.toPlace();

      await place.fetchFields({
        fields: ["formattedAddress", "addressComponents", "id"],
      });

      const parsed = parseGoogleAddress(place);

      onChange(parsed.formattedAddress || value || "");
      onSelectAddress?.(parsed);

      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);

      const placesLib = placesLibRef.current;
      if (placesLib?.AutocompleteSessionToken) {
        sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
      }
    } catch (err) {
      setLocalError("No pudimos completar esa dirección.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = async (e) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    }

    if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      await selectSuggestion(suggestions[activeIndex]);
    }

    if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={rootRef} className="addressAuto">
      <div className="addressAuto__inputWrap">
        <input
          id="ship_address_search"
          className="addressAuto__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
          inputMode="text"
        />

        {loading ? (
          <span className="addressAuto__status">Buscando…</span>
        ) : null}
      </div>

      {isOpen && suggestions.length > 0 ? (
        <div className="addressAuto__dropdown" role="listbox">
          {suggestions.map((suggestion, index) => {
            const label =
              suggestion?.placePrediction?.text?.toString?.() ||
              suggestion?.placePrediction?.mainText?.text ||
              "Dirección";

            const key =
              suggestion?.placePrediction?.placeId || `${label}-${index}`;

            return (
              <button
                key={key}
                type="button"
                className={`addressAuto__option ${
                  index === activeIndex ? "is-active" : ""
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(suggestion)}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      {localError ? (
        <p className="addressAuto__error">{localError}</p>
      ) : null}
    </div>
  );
}