/* ============================================================
   Shared MapLibre GL helpers - real maps of Rwanda with genuine
   rotate + tilt + pan + zoom (not just zoom):
     - drag with the right mouse button, or Ctrl + drag, to rotate
     - the compass control (top-right) also rotates and resets north
     - the same control's pitch changes tilt; scroll/pinch to zoom
   Tiles: OpenFreeMap (https://openfreemap.org) - no API key needed.
   ============================================================ */

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const RWANDA_CENTER = [29.8739, -1.9403]; // MapLibre uses [lng, lat]

function createRwandaMap(containerId, opts) {
  opts = opts || {};
  if (!document.getElementById(containerId) || !window.maplibregl) return null;
  const map = new maplibregl.Map({
    container: containerId,
    style: MAP_STYLE_URL,
    center: opts.center || RWANDA_CENTER,
    zoom: opts.zoom != null ? opts.zoom : 7.2,
    pitch: opts.pitch || 0,
    attributionControl: true
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
  map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
  return map;
}

function pinElement(className, label) {
  const el = document.createElement("div");
  el.className = className;
  if (label) el.textContent = label;
  return el;
}

function addHospitalMarkers(map, hospitals) {
  (hospitals || []).forEach(function (h) {
    const el = pinElement("hosp-pin", "H");
    const badge = h.tier ? ' <span class="tier-chip tier-' + h.tier.toLowerCase() + '">' + h.tier + '</span>' : "";
    const popup = new maplibregl.Popup({ offset: 16 }).setHTML(
      "<strong>" + h.name + "</strong>" + badge + "<br>" + h.city + "<br>Tel: " + h.phone +
      (h.blood ? "<br><em>Blood bank available</em>" : "")
    );
    new maplibregl.Marker({ element: el }).setLngLat([h.lng, h.lat]).setPopup(popup).addTo(map);
  });
}

function addPharmacyMarkers(map, pharmacies) {
  (pharmacies || []).forEach(function (p) {
    const el = pinElement("pharm-pin", "Rx");
    const popup = new maplibregl.Popup({ offset: 16 }).setHTML(
      "<strong>" + p.name + "</strong><br>" + p.city + (p.phone ? "<br>Tel: " + p.phone : "")
    );
    new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
  });
}

function addDonorMarkers(map, donors) {
  (donors || []).filter(d => typeof d.lat === "number").forEach(function (d) {
    const el = pinElement("donor-pin");
    const popup = new maplibregl.Popup({ offset: 12 }).setHTML(
      "<strong>Donor: " + d.fullName + "</strong><br>Blood group: " + d.bloodGroup + "<br>Area: " + d.city
    );
    new maplibregl.Marker({ element: el }).setLngLat([d.lng, d.lat]).setPopup(popup).addTo(map);
  });
}

/* Supply/demand circles as a real data-driven vector layer. */
function addAreaLayer(map, areas, onClick) {
  const geojson = {
    type: "FeatureCollection",
    features: areas.map(function (a) {
      return { type: "Feature", properties: a, geometry: { type: "Point", coordinates: [a.lng, a.lat] } };
    })
  };
  function apply() {
    if (map.getSource("bdc-areas")) { map.getSource("bdc-areas").setData(geojson); return; }
    map.addSource("bdc-areas", { type: "geojson", data: geojson });
    map.addLayer({
      id: "bdc-areas-circle", type: "circle", source: "bdc-areas",
      paint: {
        "circle-radius": 16,
        "circle-color": ["match", ["get", "status"], "supply", "#2e9e5b", "demand", "#d7263d", "#e0a100"],
        "circle-stroke-color": "#ffffff", "circle-stroke-width": 2
      }
    });
    map.on("click", "bdc-areas-circle", function (e) { if (onClick) onClick(e.features[0].properties); });
    map.on("mouseenter", "bdc-areas-circle", function () { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "bdc-areas-circle", function () { map.getCanvas().style.cursor = ""; });
  }
  if (map.isStyleLoaded()) apply(); else map.on("load", apply);
}

/* Click-to-place / drag-to-adjust pin used by every location picker. */
function makePicker(map, onPlace) {
  let marker = null;
  function place(lng, lat) {
    if (marker) marker.setLngLat([lng, lat]);
    else {
      marker = new maplibregl.Marker({ draggable: true, color: "#d7263d" }).setLngLat([lng, lat]).addTo(map);
      marker.on("dragend", function () { const p = marker.getLngLat(); onPlace(p.lat, p.lng); });
    }
    onPlace(lat, lng);
  }
  map.on("click", function (e) { place(e.lngLat.lng, e.lngLat.lat); });
  return {
    place: place,
    remove: function () { if (marker) { marker.remove(); marker = null; } }
  };
}

function addRoute(map, coordsLngLat, id) {
  const data = { type: "Feature", geometry: { type: "LineString", coordinates: coordsLngLat } };
  function apply() {
    if (map.getSource(id)) { map.getSource(id).setData(data); return; }
    map.addSource(id, { type: "geojson", data: data });
    map.addLayer({
      id: id + "-line", type: "line", source: id,
      paint: { "line-color": "#0e9aa7", "line-width": 3, "line-dasharray": [2, 2] }
    });
  }
  if (map.isStyleLoaded()) apply(); else map.on("load", apply);
}

function simpleMarker(map, lng, lat, className, label, popupHtml) {
  const el = pinElement(className, label);
  const m = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
  if (popupHtml) m.setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(popupHtml));
  return m;
}
