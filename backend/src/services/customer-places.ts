import type { ShippingAddress } from "../types/order.js";

export interface PlacePrediction {
  placeId: string;
  address: string;
}

export interface ResolvedCustomerPlace {
  placeId: string;
  formattedAddress: string;
  address: ShippingAddress;
}

export interface CustomerPlacesService {
  readonly isConfigured: boolean;
  autocomplete(input: string, sessionToken: string): Promise<PlacePrediction[]>;
  getPlace(placeId: string, sessionToken: string): Promise<ResolvedCustomerPlace>;
}

export function createGoogleCustomerPlacesService(apiKey: string): CustomerPlacesService {
  return {
    isConfigured: Boolean(apiKey),
    async autocomplete(input, sessionToken) {
      assertConfigured(apiKey);
      const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: googleHeaders(apiKey, "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text"),
        body: JSON.stringify({ input, sessionToken, includedRegionCodes: ["ph"], regionCode: "PH", languageCode: "en" }),
      });
      if (!response.ok) throw new Error("Google Places autocomplete failed.");
      return readPredictions(await response.json());
    },
    async getPlace(placeId, sessionToken) {
      assertConfigured(apiKey);
      const query = new URLSearchParams({ sessionToken, languageCode: "en", regionCode: "PH" });
      const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${query}`, {
        headers: googleHeaders(apiKey, "id,formattedAddress,addressComponents"),
      });
      if (!response.ok) throw new Error("Google Place Details failed.");
      return readPlace(await response.json());
    },
  };
}

function readPredictions(value: unknown): PlacePrediction[] {
  if (!isRecord(value) || !Array.isArray(value.suggestions)) return [];
  return value.suggestions.flatMap((suggestion) => {
    if (!isRecord(suggestion) || !isRecord(suggestion.placePrediction) || !isRecord(suggestion.placePrediction.text)) return [];
    const placeId = suggestion.placePrediction.placeId;
    const address = suggestion.placePrediction.text.text;
    return typeof placeId === "string" && typeof address === "string" ? [{ placeId, address }] : [];
  }).slice(0, 8);
}

function readPlace(value: unknown): ResolvedCustomerPlace {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.formattedAddress !== "string" || !Array.isArray(value.addressComponents)) {
    throw new Error("Google Place Details returned invalid data.");
  }
  const components = value.addressComponents.filter(isAddressComponent);
  const countryCode = shortComponent(components, "country");
  if (countryCode !== "PH") throw new Error("Choose an address in the Philippines.");
  const street = [component(components, "street_number"), component(components, "route")].filter(Boolean).join(" ")
    || component(components, "premise") || component(components, "point_of_interest");
  return {
    placeId: value.id,
    formattedAddress: value.formattedAddress,
    address: {
      street,
      region: component(components, "administrative_area_level_1"),
      province: component(components, "administrative_area_level_2"),
      locality: component(components, "locality") || component(components, "administrative_area_level_3"),
      district: component(components, "sublocality_level_2"),
      barangay: component(components, "sublocality_level_1") || component(components, "neighborhood"),
      postalCode: component(components, "postal_code"),
      country: "Philippines",
    },
  };
}

interface AddressComponent { longText: string; shortText: string; types: string[] }

function component(components: AddressComponent[], type: string): string {
  return components.find((item) => item.types.includes(type))?.longText || "";
}

function shortComponent(components: AddressComponent[], type: string): string {
  return components.find((item) => item.types.includes(type))?.shortText || "";
}

function isAddressComponent(value: unknown): value is AddressComponent {
  return isRecord(value) && typeof value.longText === "string" && typeof value.shortText === "string"
    && Array.isArray(value.types) && value.types.every((type) => typeof type === "string");
}

function googleHeaders(apiKey: string, fieldMask: string): Record<string, string> {
  return { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": fieldMask };
}

function assertConfigured(apiKey: string): void {
  if (!apiKey) throw new Error("Google Places is not configured.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
