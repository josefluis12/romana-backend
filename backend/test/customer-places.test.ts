import assert from "node:assert/strict";
import test from "node:test";
import { createGoogleCustomerPlacesService } from "../src/services/customer-places.js";

test("restricts Google suggestions to the Philippines", async (context) => {
  const originalFetch = globalThis.fetch;
  let requestBody = "";
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_input, init) => {
    requestBody = String(init?.body);
    return Response.json({ suggestions: [{ placePrediction: { placeId: "place-1", text: { text: "Session Road, Baguio" } } }] });
  };
  const places = createGoogleCustomerPlacesService("test-key");
  assert.deepEqual(await places.autocomplete("Session", "session-token"), [{ placeId: "place-1", address: "Session Road, Baguio" }]);
  assert.match(requestBody, /"includedRegionCodes":\["ph"\]/);
});

test("maps Google address components to the customer address contract", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({
    id: "place-1",
    formattedAddress: "12 Session Road, Baguio, 2600 Philippines",
    addressComponents: [
      component("12", "12", "street_number"),
      component("Session Road", "Session Rd", "route"),
      component("Baguio", "Baguio", "locality"),
      component("Benguet", "Benguet", "administrative_area_level_2"),
      component("Cordillera Administrative Region", "CAR", "administrative_area_level_1"),
      component("Barangay 13", "Brgy 13", "sublocality_level_1"),
      component("2600", "2600", "postal_code"),
      component("Philippines", "PH", "country"),
    ],
  });
  const place = await createGoogleCustomerPlacesService("test-key").getPlace("place-1", "session-token");
  assert.deepEqual(place.address, {
    street: "12 Session Road",
    region: "Cordillera Administrative Region",
    province: "Benguet",
    locality: "Baguio",
    district: "",
    barangay: "Barangay 13",
    postalCode: "2600",
    country: "Philippines",
  });
});

function component(longText: string, shortText: string, type: string) {
  return { longText, shortText, types: [type] };
}
