"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { useAdminSession } from "../_lib/admin-session";

type IncidentPt = {
  id: string;
  latitude: number;
  longitude: number;
  crimeCategory: string;
  status: string;
  locationLabel: string | null;
  createdAt: string;
};

type ApiOk<T> = { success: true; message: string; data: T };
type ApiErr = { success: false; message: string };

const mapContainerStyle = {
  width: "100%",
  height: "min(70vh, 560px)",
  minHeight: "400px",
};

const defaultCenter = { lat: 20, lng: 0 };

function MissingKey() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">
      <p className="font-semibold">Google Maps API key missing</p>
      <p className="mt-2 text-amber-800">
        Add <code className="rounded bg-white px-1.5 py-0.5">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to{" "}
        <code className="rounded bg-white px-1.5 py-0.5">crime-backend/.env</code>, enable the{" "}
        <strong>Maps JavaScript API</strong> for your Google Cloud project, then restart the dev server.
      </p>
    </div>
  );
}

function IncidentMapInner({ apiKey }: { apiKey: string }) {
  const { accessToken, authHeaders } = useAdminSession();
  const [points, setPoints] = useState<IncidentPt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "admin-incidents-map",
    googleMapsApiKey: apiKey,
  });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("pageSize", "500");
      const res = await fetch(`/api/admin/incidents?${params.toString()}`, {
        headers: authHeaders(),
      });
      const payload = (await res.json()) as ApiOk<{ items: IncidentPt[] }> | ApiErr;
      if (!res.ok || !payload.success) {
        throw new Error("message" in payload ? payload.message : "Failed to load map data");
      }
      setPoints(payload.data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [accessToken, authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || points.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }));
    map.fitBounds(bounds);
  }, [points, isLoaded]);

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Could not load Google Maps: {loadError.message}
      </div>
    );
  }

  const center =
    points.length > 0 ? { lat: points[0].latitude, lng: points[0].longitude } : defaultCenter;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          onClick={() => load()}
        >
          Refresh markers
        </button>
        {loading ? <span className="text-sm text-slate-500">Loading…</span> : null}
        <span className="text-sm text-slate-600">{points.length} points (max 500)</span>
      </div>
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      {!isLoaded ? (
        <div className="flex h-[400px] items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500">
          Loading Google Maps…
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={points.length ? 12 : 2}
            onLoad={onMapLoad}
            options={{
              mapTypeControl: true,
              streetViewControl: false,
              fullscreenControl: true,
            }}
          >
            {points.map((p) => (
              <Marker
                key={p.id}
                position={{ lat: p.latitude, lng: p.longitude }}
                title={`${p.crimeCategory} · ${p.status}`}
              />
            ))}
          </GoogleMap>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Map data © Google. Incident positions use coordinates from submitted reports.
      </p>
    </div>
  );
}

export function IncidentMap() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  if (!apiKey.trim()) {
    return <MissingKey />;
  }
  return <IncidentMapInner apiKey={apiKey.trim()} />;
}
