import { useEffect, useMemo, useState } from "react";
import type { PhilippineAddress } from "../../../../types/channel-sale";

interface AddressOption { code: string; name: string }
interface Province extends AddressOption { regionCode: string }
interface Locality extends AddressOption { regionCode: string; provinceCode?: string; zipCode: string }
interface District extends AddressOption { localityCode: string }
interface Barangay extends AddressOption { localityCode?: string; districtCode?: string }
interface AddressData {
  regions: AddressOption[];
  provinces: Province[];
  localities: Locality[];
  districts: District[];
  barangays: Barangay[];
}

interface Props {
  value: PhilippineAddress;
  onChange: (value: PhilippineAddress) => void;
}

let addressDataRequest: Promise<AddressData> | null = null;

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
  const [data, setData] = useState<AddressData | null>(null);
  const [error, setError] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const [localityCode, setLocalityCode] = useState("");
  const [districtCode, setDistrictCode] = useState("");

  useEffect(() => {
    let active = true;
    loadAddressData()
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setError("Philippine address options could not be loaded. Refresh and try again."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (value.region) return;
    setRegionCode("");
    setProvinceCode("");
    setLocalityCode("");
    setDistrictCode("");
  }, [value.region]);

  const provinces = useMemo(() => data?.provinces.filter((item) => item.regionCode === regionCode) ?? [], [data, regionCode]);
  const hasIndependentLocalities = data?.localities.some((item) => item.regionCode === regionCode && !item.provinceCode) ?? false;
  const localities = useMemo(() => data?.localities.filter((item) => {
    if (provinceCode === "__independent__") return item.regionCode === regionCode && !item.provinceCode;
    if (!provinces.length) return item.regionCode === regionCode;
    return item.provinceCode === provinceCode;
  }) ?? [], [data, provinceCode, provinces.length, regionCode]);
  const districts = useMemo(() => data?.districts.filter((item) => item.localityCode === localityCode) ?? [], [data, localityCode]);
  const barangays = useMemo(() => data?.barangays.filter((item) => districtCode
    ? item.districtCode === districtCode
    : item.localityCode === localityCode) ?? [], [data, districtCode, localityCode]);

  function selectRegion(code: string) {
    setRegionCode(code);
    setProvinceCode("");
    setLocalityCode("");
    setDistrictCode("");
    onChange({ ...value, region: nameFor(data?.regions, code), province: "", locality: "", district: "", barangay: "", postalCode: "" });
  }

  function selectProvince(code: string) {
    setProvinceCode(code);
    setLocalityCode("");
    setDistrictCode("");
    onChange({ ...value, province: code === "__independent__" ? "" : nameFor(provinces, code), locality: "", district: "", barangay: "", postalCode: "" });
  }

  function selectLocality(code: string) {
    const locality = localities.find((item) => item.code === code);
    setLocalityCode(code);
    setDistrictCode("");
    onChange({ ...value, locality: locality?.name ?? "", district: "", barangay: "", postalCode: locality?.zipCode ?? "" });
  }

  function selectDistrict(code: string) {
    setDistrictCode(code);
    onChange({ ...value, district: nameFor(districts, code), barangay: "" });
  }

  return (
    <>
      <AddressField label="Street address" wide>
        <input required autoComplete="street-address" maxLength={300} value={value.street} onChange={(event) => onChange({ ...value, street: event.target.value })} />
      </AddressField>
      <AddressSelect label="Region" value={regionCode} options={data?.regions ?? []} placeholder={data ? "Select a region" : "Loading regions…"} disabled={!data} onChange={selectRegion} />
      <AddressSelect label="Province" value={provinceCode} options={hasIndependentLocalities && provinces.length ? [...provinces, { code: "__independent__", name: "Independent city or municipality" }] : provinces} placeholder={regionCode ? (provinces.length ? "Select a province" : "Not applicable") : "Select a region first"} disabled={!regionCode || !provinces.length} required={provinces.length > 0} onChange={selectProvince} />
      <AddressSelect label="City or municipality" value={localityCode} options={localities} placeholder={regionCode ? "Select a city or municipality" : "Select a region first"} disabled={!regionCode || (provinces.length > 0 && !provinceCode)} onChange={selectLocality} />
      <AddressSelect label="District" value={districtCode} options={districts} placeholder={localityCode ? (districts.length ? "Select a district" : "Not applicable") : "Select a city first"} disabled={!localityCode || !districts.length} required={districts.length > 0} onChange={selectDistrict} />
      <AddressSelect label="Barangay" value={value.barangay} options={barangays.map((item) => ({ code: item.name, name: item.name }))} placeholder={localityCode ? "Select a barangay" : "Select a city first"} disabled={!localityCode || (districts.length > 0 && !districtCode)} onChange={(barangay) => onChange({ ...value, barangay })} />
      <AddressField label="Postal code">
        <input required inputMode="numeric" autoComplete="postal-code" maxLength={12} value={value.postalCode} onChange={(event) => onChange({ ...value, postalCode: event.target.value })} />
      </AddressField>
      <AddressField label="Country"><input value="Philippines" disabled /></AddressField>
      <p className={`m-0 text-xs md:col-span-2 ${error ? "text-[var(--red)]" : "text-[var(--muted)]"}`} role="status">
        {error || "Choose each location in order. Postal code is filled from the selected city or municipality."}
      </p>
    </>
  );
}

function AddressSelect({ label, value, options, placeholder, disabled, required = true, onChange }: {
  label: string; value: string; options: AddressOption[]; placeholder: string; disabled: boolean; required?: boolean; onChange: (value: string) => void;
}) {
  return <AddressField label={label}><select required={required} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{placeholder}</option>{options.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}</select></AddressField>;
}

function AddressField({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`grid gap-2 text-sm font-bold text-[#4b4944] ${wide ? "md:col-span-2" : ""}`}>{label}<span className="[&>input]:h-11 [&>input]:w-full [&>input]:rounded [&>input]:border [&>input]:border-[#cbc7bd] [&>input]:px-3 [&>select]:h-11 [&>select]:w-full [&>select]:rounded [&>select]:border [&>select]:border-[#cbc7bd] [&>select]:bg-white [&>select]:px-3 disabled:[&>input]:bg-[#f2f0eb] disabled:[&>select]:bg-[#f2f0eb]">{children}</span></label>;
}

function nameFor(options: AddressOption[] | undefined, code: string): string {
  return options?.find((item) => item.code === code)?.name ?? "";
}

function loadAddressData(): Promise<AddressData> {
  addressDataRequest ??= fetch("/data/philippine-addresses.json")
    .then((response) => {
      if (!response.ok) throw new Error("Address data request failed.");
      return response.json() as Promise<AddressData>;
    });
  return addressDataRequest;
}
