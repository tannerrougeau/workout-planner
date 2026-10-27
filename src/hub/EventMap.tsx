import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "./format";

export interface MapPin extends LatLng {
  id: string;
  label: string;
}

interface Props {
  pins?: MapPin[];
  center?: LatLng;
  /** Tapping the map moves a single draggable pin here (for choosing a meeting place). */
  pick?: { value?: LatLng; onPick: (p: LatLng) => void };
  onSelect?: (id: string) => void;
  height?: number;
}

const WORLD: LatLng = { lat: 39.8, lng: -98.6 };

// A CSS dot instead of Leaflet's image marker, which bundlers can't resolve.
const pinIcon = (active = false) =>
  L.divIcon({ className: active ? "map-pin active" : "map-pin", iconSize: [22, 22], iconAnchor: [11, 11] });

export function EventMap({ pins = [], center, pick, onSelect, height = 260 }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | undefined>(undefined);
  const layer = useRef<L.LayerGroup | undefined>(undefined);
  const pickMarker = useRef<L.Marker | undefined>(undefined);
  const onPick = useRef(pick?.onPick);
  onPick.current = pick?.onPick;

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: true, attributionControl: true }).setView(
      [center?.lat ?? WORLD.lat, center?.lng ?? WORLD.lng],
      center ? 12 : 3,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => onPick.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    map.current = m;
    return () => {
      m.remove();
      map.current = undefined;
    };
  }, []); // Created once; the effects below apply later prop changes.

  useEffect(() => {
    const m = map.current;
    const group = layer.current;
    if (!m || !group) return;
    group.clearLayers();
    for (const p of pins) {
      L.marker([p.lat, p.lng], { icon: pinIcon(), title: p.label, keyboard: true })
        .bindTooltip(p.label, { direction: "top", offset: [0, -10] })
        .on("click", () => onSelect?.(p.id))
        .addTo(group);
    }
    if (pins.length > 1) m.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng])), { padding: [32, 32], maxZoom: 14 });
    else if (pins.length === 1) m.setView([pins[0].lat, pins[0].lng], 14);
  }, [pins, onSelect]);

  useEffect(() => {
    if (center && !pins.length) map.current?.setView([center.lat, center.lng], 13);
  }, [center?.lat, center?.lng, pins.length]);

  useEffect(() => {
    const m = map.current;
    const value = pick?.value;
    if (!m) return;
    if (!value) {
      pickMarker.current?.remove();
      pickMarker.current = undefined;
      return;
    }
    if (!pickMarker.current) {
      pickMarker.current = L.marker([value.lat, value.lng], { icon: pinIcon(true), draggable: true })
        .on("dragend", (e) => {
          const p = (e.target as L.Marker).getLatLng();
          onPick.current?.({ lat: p.lat, lng: p.lng });
        })
        .addTo(m);
      m.setView([value.lat, value.lng], Math.max(m.getZoom(), 14));
    } else {
      pickMarker.current.setLatLng([value.lat, value.lng]);
    }
  }, [pick?.value?.lat, pick?.value?.lng]);

  return <div ref={el} className="event-map" style={{ height }} role="application" aria-label={pick ? "Map: tap to set the meeting place" : "Map of events"} />;
}
