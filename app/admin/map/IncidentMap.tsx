"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader, Marker, Circle, InfoWindow } from "@react-google-maps/api";
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

type Hotspot = {
  id: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  riskScore: number;
  crimeCategory: string | null;
  incidentCount: number;
};

type AnalyticsPayload = {
  hotspots: Hotspot[];
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
  const [viewMode, setViewMode] = useState<"incidents" | "hotspots">("incidents");
  const [points, setPoints] = useState<IncidentPt[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<IncidentPt | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
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
      
      const auth = authHeaders();
      const [incRes, analyticsRes] = await Promise.all([
        fetch(`/api/admin/incidents?${params.toString()}`, { headers: auth }),
        fetch(`/api/admin/analytics`, { headers: auth }),
      ]);

      const incPayload = (await incRes.json()) as ApiOk<{ items: IncidentPt[] }> | ApiErr;
      const analyticsPayload = (await analyticsRes.json()) as ApiOk<AnalyticsPayload> | ApiErr;

      if (!incRes.ok || !incPayload.success) {
        throw new Error("message" in incPayload ? incPayload.message : "Failed to load markers");
      }
      setPoints(incPayload.data.items);

      if (analyticsRes.ok && analyticsPayload.success) {
        setHotspots(analyticsPayload.data.hotspots);
      }
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
    const items = viewMode === "incidents" ? points : hotspots;
    if (!map || items.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    items.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }));
    map.fitBounds(bounds);
  }, [points, hotspots, isLoaded, viewMode]);

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
        <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === "incidents"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
            onClick={() => { setViewMode("incidents"); setSelectedHotspot(null); }}
          >
            Incidents
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === "hotspots"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
            onClick={() => { setViewMode("hotspots"); setSelectedPoint(null); }}
          >
            Intelligence (Hotspots)
          </button>
        </div>
        <button
          type="button"
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          onClick={() => load()}
        >
          Refresh data
        </button>
        {loading ? <span className="text-sm text-slate-500">Loading…</span> : null}
        <span className="text-sm text-slate-600 capitalize">
          {viewMode}: {viewMode === "incidents" ? points.length : hotspots.length}
        </span>
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
            {viewMode === "incidents"
              ? points.map((p) => (
                  <Marker
                    key={p.id}
                    position={{ lat: p.latitude, lng: p.longitude }}
                    onClick={() => setSelectedPoint(p)}
                  />
                ))
              : hotspots.map((h) => (
                  <Circle
                    key={h.id}
                    center={{ lat: h.latitude, lng: h.longitude }}
                    radius={h.radiusMeters}
                    onClick={() => setSelectedHotspot(h)}
                    options={{
                      fillColor: h.riskScore > 70 ? "#ef4444" : h.riskScore > 40 ? "#f97316" : "#3b82f6",
                      fillOpacity: Math.max(0.3, h.riskScore / 100),
                      strokeColor: "#ffffff",
                      strokeOpacity: 0.8,
                      strokeWeight: 1,
                    }}
                  />
                ))}

            {selectedPoint && (
              <InfoWindow
                position={{ lat: selectedPoint.latitude, lng: selectedPoint.longitude }}
                onCloseClick={() => setSelectedPoint(null)}
              >
                <div className="p-2 min-w-[200px]">
                  <h3 className="text-sm font-bold text-slate-900 capitalize">
                    {selectedPoint.crimeCategory.replace(/_/g, " ")}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    <span className="font-semibold">Status:</span> {selectedPoint.status}
                  </p>
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold">Location:</span> {selectedPoint.locationLabel ?? "Unknown"}
                  </p>
                  <p className="mt-2 text-[10px] text-slate-400">
                    {new Date(selectedPoint.createdAt).toLocaleString()}
                  </p>
                </div>
              </InfoWindow>
            )}

            {selectedHotspot && (
              <InfoWindow
                position={{ lat: selectedHotspot.latitude, lng: selectedHotspot.longitude }}
                onCloseClick={() => setSelectedHotspot(null)}
              >
                <div className="p-2 min-w-[200px]">
                  <h3 className="text-sm font-bold text-red-700 capitalize">
                    High Risk: {selectedHotspot.crimeCategory?.replace(/_/g, " ") ?? "Mixed Crimes"}
                  </h3>
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-slate-700">
                      <span className="font-semibold">Risk Score:</span> {selectedHotspot.riskScore.toFixed(0)}/100
                    </p>
                    <p className="text-xs text-slate-700">
                      <span className="font-semibold">Density:</span> {selectedHotspot.incidentCount} reports
                    </p>
                    <p className="text-xs text-slate-700">
                      <span className="font-semibold">Radius:</span> {selectedHotspot.radiusMeters}m
                    </p>
                  </div>
                  <p className="mt-3 text-[10px] text-slate-500 italic">
                    Calculated based on recent activity density and crime severity.
                  </p>
                </div>
              </InfoWindow>
            )}
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
