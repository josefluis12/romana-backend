import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DispatchLocationPing } from "../_lib/dispatch-location";

export function DispatchLocationMap({ locations }: { locations: DispatchLocationPing[] }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element || !locations.length) return;
    let active = true;
    let map: LeafletMap | null = null;

    void import("leaflet").then((leaflet) => {
      if (!active) return;
      const nextMap = leaflet.map(element, { scrollWheelZoom: false });
      map = nextMap;
      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(nextMap);

      const bounds = leaflet.latLngBounds([]);
      locations.forEach((location, index) => {
        const position = leaflet.latLng(location.latitude, location.longitude);
        const label = document.createElement("span");
        label.className = "grid size-7 place-items-center rounded-full border-2 border-white bg-[var(--red)] text-xs font-bold text-white shadow-md";
        label.textContent = String(index + 1);
        leaflet.marker(position, {
          icon: leaflet.divIcon({ className: "", html: label, iconAnchor: [14, 14], iconSize: [28, 28] }),
          title: `Driver ping ${index + 1}`,
        }).addTo(nextMap);
        bounds.extend(position);
      });

      if (locations.length === 1) nextMap.setView(bounds.getCenter(), 16);
      else nextMap.fitBounds(bounds, { maxZoom: 16, padding: [36, 36] });
    });

    return () => {
      active = false;
      map?.remove();
    };
  }, [locations]);

  return <div ref={container} className="mt-4 h-64 w-full overflow-hidden rounded bg-white sm:h-80" aria-label="Map of driver location pings" />;
}
