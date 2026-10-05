import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { getCustomerLocation, searchCustomerLocations, type CustomerPlacePrediction } from "../../../../services/channel-sales";
import type { PhilippineAddress } from "../../../../types/channel-sale";

interface Props {
  value: PhilippineAddress;
  onChange: (value: PhilippineAddress) => void;
}

export const emptyPhilippineAddress: PhilippineAddress = {
  street: "",
  region: "",
  province: "",
  locality: "",
  district: "",
  barangay: "",
  postalCode: "",
  country: "Philippines",
};

export function PhilippineAddressFields({ value, onChange }: Props) {
  const searchInput = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const sessionToken = useRef(createSessionToken());
  const [query, setQuery] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [predictions, setPredictions] = useState<CustomerPlacePrediction[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (selectedPlaceId || query.trim().length < 3) {
      setPredictions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      searchCustomerLocations(query.trim(), sessionToken.current, controller.signal)
        .then((items) => { setPredictions(items); setHighlighted(0); setError(""); })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Address suggestions are unavailable.");
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, selectedPlaceId]);

  async function selectPrediction(prediction: CustomerPlacePrediction) {
    setLoading(true);
    setError("");
    try {
      const place = await getCustomerLocation(prediction.placeId, sessionToken.current);
      setQuery(place.formattedAddress);
      setSelectedPlaceId(place.placeId);
      setPredictions([]);
      searchInput.current?.setCustomValidity("");
      onChange(place.address);
      sessionToken.current = createSessionToken();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The selected address could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function changeSearch(nextQuery: string) {
    setQuery(nextQuery);
    setSelectedPlaceId("");
    searchInput.current?.setCustomValidity(nextQuery ? "Choose an address from the Google suggestions." : "");
  }

  function update(field: keyof PhilippineAddress, nextValue: string) {
    onChange({ ...value, [field]: nextValue });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") return setPredictions([]);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((current) => Math.min(current + 1, predictions.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((current) => Math.max(current - 1, 0));
    }
    if (event.key === "Enter" && predictions[highlighted]) {
      event.preventDefault();
      void selectPrediction(predictions[highlighted]);
    }
  }

  return (
    <>
      <div className="relative grid gap-2 text-sm font-bold text-[#4b4944] md:col-span-2">
        <label htmlFor={`${fieldId}-search`}>Search delivery location</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-[var(--muted)]" aria-hidden="true" />
          <input
            ref={searchInput}
            className="h-11 w-full rounded border border-[#cbc7bd] bg-white py-2 pl-10 pr-3 outline-none focus:border-[var(--red)] focus:ring-1 focus:ring-[var(--red)]"
            id={`${fieldId}-search`}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={`${fieldId}-suggestions`}
            aria-expanded={predictions.length > 0}
            aria-activedescendant={predictions[highlighted] ? `${fieldId}-option-${highlighted}` : undefined}
            autoComplete="off"
            required
            value={query}
            placeholder="Start typing a Philippine address"
            onChange={(event) => changeSearch(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          {predictions.length > 0 && (
            <div className="absolute inset-x-0 top-full z-40 max-h-60 overflow-y-auto rounded-b border border-t-0 border-[#cbc7bd] bg-white shadow-lg" id={`${fieldId}-suggestions`} role="listbox">
              {predictions.map((prediction, index) => (
                <button
                  className={`block w-full px-4 py-3 text-left text-sm font-normal ${index === highlighted ? "bg-[#f7e9e9] text-[var(--red)]" : "bg-white text-[#34322e] hover:bg-[#f5f3ee]"}`}
                  id={`${fieldId}-option-${index}`}
                  key={prediction.placeId}
                  type="button"
                  role="option"
                  aria-selected={index === highlighted}
                  onMouseEnter={() => setHighlighted(index)}
                  onMouseDown={(event) => { event.preventDefault(); void selectPrediction(prediction); }}
                >
                  {prediction.address}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className={`m-0 text-xs ${error ? "text-[var(--red)]" : "text-[var(--muted)]"}`} role="status">
          {error || (loading ? "Searching Google Maps…" : "Choose a result, then confirm any missing delivery details below.")}
        </p>
        <p className="m-0 justify-self-end text-[10px] font-bold text-[#5f6368]">Powered by Google</p>
      </div>
      <AddressInput label="Street address" value={value.street} required wide onChange={(text) => update("street", text)} />
      <AddressInput label="Region" value={value.region} required onChange={(text) => update("region", text)} />
      <AddressInput label="Province" value={value.province} onChange={(text) => update("province", text)} />
      <AddressInput label="City or municipality" value={value.locality} required onChange={(text) => update("locality", text)} />
      <AddressInput label="District" value={value.district} onChange={(text) => update("district", text)} />
      <AddressInput label="Barangay" value={value.barangay} required onChange={(text) => update("barangay", text)} />
      <AddressInput label="Postal code" value={value.postalCode} required onChange={(text) => update("postalCode", text)} />
      <AddressInput label="Country" value="Philippines" disabled onChange={() => undefined} />
    </>
  );
}

function AddressInput({ label, value, required = false, wide = false, disabled = false, onChange }: {
  label: string; value: string; required?: boolean; wide?: boolean; disabled?: boolean; onChange: (value: string) => void;
}) {
  return (
    <label className={`grid gap-2 text-sm font-bold text-[#4b4944] ${wide ? "md:col-span-2" : ""}`}>
      {label}
      <input className="h-11 w-full rounded border border-[#cbc7bd] px-3 disabled:bg-[#f2f0eb]" disabled={disabled} required={required} maxLength={300} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function createSessionToken(): string {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
