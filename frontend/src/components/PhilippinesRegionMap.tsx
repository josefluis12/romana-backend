import type { RegionSummary } from "./customer-analytics";
import { philippineMapRegions } from "./philippine-map-data";

const aliases = [
  ["national capital", "ncr", "metro manila"],
  ["cordillera", "car"],
  ["bangsamoro", "barmm", "armm"],
  ["mimaropa", "iv-b"],
  ["calabarzon", "iv-a"],
  ["ilocos", "region i"],
  ["cagayan valley", "region ii"],
  ["central luzon", "region iii"],
  ["bicol", "region v"],
  ["western visayas", "region vi"],
  ["central visayas", "region vii"],
  ["eastern visayas", "region viii"],
  ["zamboanga peninsula", "region ix"],
  ["northern mindanao", "region x"],
  ["davao", "region xi"],
  ["soccsksargen", "region xii"],
  ["caraga", "region xiii"],
];

export function PhilippinesRegionMap({ regions }: { regions: RegionSummary[] }) {
  const maximum = Math.max(...regions.map((region) => region.orderCount), 1);
  return (
    <div className="region-map">
      <svg className="philippines-map" viewBox="0 0 345 545" role="img" aria-labelledby="philippines-map-title philippines-map-description">
        <title id="philippines-map-title">Online order distribution across Philippine regions</title>
        <desc id="philippines-map-description">Administrative region boundaries are shaded by total online orders.</desc>
        {philippineMapRegions.map((mapRegion) => {
          const summary = matchRegion(mapRegion.name, regions);
          const orderCount = summary?.orderCount ?? 0;
          const label = `${displayName(mapRegion.name)}: ${orderCount} order${orderCount === 1 ? "" : "s"}`;
          return (
            <path
              aria-label={label}
              className={orderCount ? "map-region has-orders" : "map-region"}
              d={mapRegion.path}
              fill={regionColor(orderCount, maximum)}
              fillRule="evenodd"
              key={mapRegion.code}
              tabIndex={0}
            >
              <title>{label}</title>
            </path>
          );
        })}
      </svg>
      <div className="map-legend" aria-hidden="true"><span>Fewer</span><i /><i /><i /><i /><span>More orders</span></div>
    </div>
  );
}

function matchRegion(mapName: string, regions: RegionSummary[]): RegionSummary | undefined {
  const mapKey = canonicalRegion(mapName);
  return regions.find((region) => canonicalRegion(region.name) === mapKey);
}

function canonicalRegion(name: string): string {
  const normalized = name.toLowerCase();
  const match = aliases
    .flatMap((group) => group.map((alias) => ({ alias, key: group[0] })))
    .filter(({ alias }) => normalized.includes(alias))
    .sort((left, right) => right.alias.length - left.alias.length)[0];
  return match?.key ?? normalized.replace(/[^a-z0-9]/g, "");
}

function displayName(name: string): string {
  return name.replace(/^Region\s+[IVX-]+\s*\((.+)\)$/i, "$1");
}

function regionColor(orderCount: number, maximum: number): string {
  if (!orderCount) return "#e3dfd5";
  const strength = orderCount / maximum;
  const lightness = Math.round(69 - strength * 26);
  return `hsl(357 72% ${lightness}%)`;
}
