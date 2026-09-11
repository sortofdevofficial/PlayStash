import { flood } from "../nd/flood.js";
import { earthquake } from "../nd/earthquake.js";
import { lightning } from "../nd/lightning.js";
import { wildfire } from "../nd/wildfire.js";

// ... (previous code)

// Disaster management
const disasters = [
  flood,
  earthquake,
  lightning,
  wildfire
];

// ... (rest of the file)

// Disaster trigger logic
export function triggerDisaster(disasterName, npcs, scene, camera, engine) {
  const disaster = disasters.find(d => d.name === disasterName);
  if (disaster && disaster.trigger) {
    disaster.trigger(npcs, scene, camera, engine);
  }
}

// ... (rest of the file)

// Periodic disaster check
export function checkDisasters(npcs, scene, camera, engine) {
  const activeDisasters = [];
  const disasterNames = [
    flood.name,
    earthquake.name,
    lightning.name,
    wildfire.name
  ];

  // Check for active disasters
  disasterNames.forEach(disasterName => {
    const disaster = disasters.find(d => d.name === disasterName);
    if (disaster && disaster.trigger) {
      // Trigger disaster logic
      disaster.trigger(npcs, scene, camera, engine);
    }
  });
}

// ... (rest of the file)

// Initialize disaster classes
const disasterInstances = {
  flood: new flood(),
  earthquake: new earthquake(),
  lightning: new lightning(),
  wildfire: new wildfire()
};

// ... (rest of the file)

// Ensure all disaster exports are properly defined
if (!flood.Flood) {
  flood.Flood = flood;
}

if (!earthquake.Earthquake) {
  earthquake.Earthquake = earthquake;
}

if (!lightning.Lightning) {
  lightning.Lightning = lightning;
}

if (!wildfire.Wildfire) {
  wildfire.Wildfire = wildfire;
}

// ... (rest of the file)

// Ensure disaster instances are activated/deactivated correctly
export function activateDisaster(disasterName) {
  const disaster = disasterInstances[disasterName];
  if (disaster && disaster.activate) {
    disaster.activate();
  }
}

export function deactivateDisaster(disasterName) {
  const disaster = disasterInstances[disasterName];
  if (disaster && disaster.deactivate) {
    disaster.deactivate();
  }
}