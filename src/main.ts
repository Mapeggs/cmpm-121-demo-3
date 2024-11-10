import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// Constants for the game setup
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 0.0001;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
let playerCoins = 0;

// Initialize the map
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Add a tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Place the player marker
const playerMarker = leaflet.marker(OAKES_CLASSROOM).addTo(map);
playerMarker.bindTooltip("You are here!");

// Display player's current coin count
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "Coins: 0";

// Function to generate caches around the player
function spawnCache(i: number, j: number) {
  const bounds = leaflet.latLngBounds([
    [
      OAKES_CLASSROOM.lat + i * TILE_DEGREES,
      OAKES_CLASSROOM.lng + j * TILE_DEGREES,
    ],
    [
      OAKES_CLASSROOM.lat + (i + 1) * TILE_DEGREES,
      OAKES_CLASSROOM.lng + (j + 1) * TILE_DEGREES,
    ],
  ]);

  // Add a rectangle as the cache marker
  const rect = leaflet.rectangle(bounds, { color: "#646cff", weight: 1 }).addTo(
    map,
  );

  // Generate a deterministic number of coins for this cache
  const coins = Math.floor(luck(`${i},${j},coins`) * 10) + 1;

  // Popup for cache with collect and deposit functionality
  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>Cache at ${i},${j}</div>
      <div>Coins available: <span id="cacheCoins">${coins}</span></div>
      <button id="collect">Collect Coins</button>
      <button id="deposit">Deposit Coins</button>`;

    // Collect coins from the cache
    popupDiv.querySelector<HTMLButtonElement>("#collect")!.onclick = () => {
      playerCoins += coins;
      statusPanel.innerHTML = `Coins: ${playerCoins}`;
      popupDiv.querySelector("#cacheCoins")!.textContent = "0";
    };

    // Deposit coins to the cache
    popupDiv.querySelector<HTMLButtonElement>("#deposit")!.onclick = () => {
      if (playerCoins > 0) {
        playerCoins--;
        popupDiv.querySelector("#cacheCoins")!.textContent = (coins + 1)
          .toString();
        statusPanel.innerHTML = `Coins: ${playerCoins}`;
      }
    };

    return popupDiv;
  });
}

// Spawn caches in a neighborhood around the player
for (let i = -NEIGHBORHOOD_SIZE; i <= NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j <= NEIGHBORHOOD_SIZE; j++) {
    if (luck(`${i},${j}`) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(i, j);
    }
  }
}
