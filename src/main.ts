import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// Constants
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 0.0001;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
const MOVEMENT_DELTA = 0.0001;
const VISIBLE_RADIUS = 0.001;
let playerCoins = 0;

// Map for storing cache cells and rectangles
const cacheMap = new Map<
  string,
  { cell: CacheCell; rect: leaflet.Rectangle }
>();

// Define a Memento to save and restore the cache state
class CacheMemento {
  private state = new Map<string, Coin[]>();

  saveState(cellKey: string, coins: Coin[]) {
    this.state.set(cellKey, coins.slice());
  }

  restoreState(cellKey: string): Coin[] | null {
    return this.state.has(cellKey) ? this.state.get(cellKey)! : null;
  }
}

const cacheMemento = new CacheMemento();

// Class to represent a grid cell
class CacheCell {
  coins: Coin[] = [];
  constructor(public i: number, public j: number) {}
}

// Class to represent a coin with a unique ID based on cache location and serial number
class Coin {
  constructor(public i: number, public j: number, public serial: number) {}
  get id() {
    return `${this.i}:${this.j}#${this.serial}`;
  }
}

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

// Convert latitude and longitude to grid coordinates
function latLngToGrid(lat: number, lng: number): { i: number; j: number } {
  return {
    i: Math.floor(lat / TILE_DEGREES),
    j: Math.floor(lng / TILE_DEGREES),
  };
}

// Function to get or create a cache cell
function getOrCreateCacheCell(i: number, j: number): CacheCell {
  const key = `${i}:${j}`;
  if (!cacheMap.has(key)) {
    cacheMap.set(key, { cell: new CacheCell(i, j), rect: null! });
  }
  return cacheMap.get(key)!.cell;
}

// Function to generate caches around the player
function spawnCache(i: number, j: number) {
  const cacheCell = getOrCreateCacheCell(i, j);

  // Convert grid coordinates to lat/lng bounds
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

  // Create a new rectangle if not already created
  const key = `${i}:${j}`;
  if (!cacheMap.get(key)?.rect) {
    const rect = leaflet.rectangle(bounds, { color: "#646cff", weight: 1 })
      .addTo(map);

    rect.bindPopup(() => {
      const popupDiv = document.createElement("div");
      popupDiv.innerHTML = `
        <div>Cache at ${i}:${j}</div>
        <div>Coins: ${cacheCell.coins.map((coin) => coin.id).join(", ")}</div>
        <button id="collect">Collect Coins</button>
        <button id="deposit">Deposit Coins</button>`;

      popupDiv.querySelector<HTMLButtonElement>("#collect")!.onclick = () => {
        playerCoins += cacheCell.coins.length;
        cacheCell.coins = [];
        statusPanel.innerHTML = `Coins: ${playerCoins}`;
        popupDiv.querySelector("div:nth-child(2)")!.textContent = "Coins: 0";
      };

      popupDiv.querySelector<HTMLButtonElement>("#deposit")!.onclick = () => {
        if (playerCoins > 0) {
          const newCoin = new Coin(i, j, cacheCell.coins.length);
          cacheCell.coins.push(newCoin);
          playerCoins--;
          popupDiv.querySelector("div:nth-child(2)")!.textContent = `Coins: ${
            cacheCell.coins.map((coin) => coin.id).join(", ")
          }`;
          statusPanel.innerHTML = `Coins: ${playerCoins}`;
        }
      };

      return popupDiv;
    });

    cacheMap.set(key, { cell: cacheCell, rect });
  }
}

// Update the player's location and regenerate nearby caches
function movePlayer(direction: string) {
  switch (direction) {
    case "north":
      OAKES_CLASSROOM.lat += MOVEMENT_DELTA;
      break;
    case "south":
      OAKES_CLASSROOM.lat -= MOVEMENT_DELTA;
      break;
    case "east":
      OAKES_CLASSROOM.lng += MOVEMENT_DELTA;
      break;
    case "west":
      OAKES_CLASSROOM.lng -= MOVEMENT_DELTA;
      break;
  }

  playerMarker.setLatLng(OAKES_CLASSROOM);

  cacheMap.forEach(({ cell, rect }, key) => {
    const cellLatLng = leaflet.latLng(
      OAKES_CLASSROOM.lat + cell.i * TILE_DEGREES,
      OAKES_CLASSROOM.lng + cell.j * TILE_DEGREES,
    );

    if (map.distance(OAKES_CLASSROOM, cellLatLng) > VISIBLE_RADIUS) {
      map.removeLayer(rect); // Safely remove the layer
      cacheMemento.saveState(key, cell.coins);
    } else {
      spawnCache(cell.i, cell.j);
      const savedCoins = cacheMemento.restoreState(key);
      if (savedCoins) cell.coins = savedCoins;
    }
  });
}

// Event listeners for button movement controls
document.getElementById("north")!.onclick = () => movePlayer("north");
document.getElementById("south")!.onclick = () => movePlayer("south");
document.getElementById("east")!.onclick = () => movePlayer("east");
document.getElementById("west")!.onclick = () => movePlayer("west");

const playerGrid = latLngToGrid(OAKES_CLASSROOM.lat, OAKES_CLASSROOM.lng);
for (let di = -NEIGHBORHOOD_SIZE; di <= NEIGHBORHOOD_SIZE; di++) {
  for (let dj = -NEIGHBORHOOD_SIZE; dj <= NEIGHBORHOOD_SIZE; dj++) {
    const gridI = playerGrid.i + di;
    const gridJ = playerGrid.j + dj;
    if (luck(`${gridI},${gridJ}`) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(gridI, gridJ);
    }
  }
}
