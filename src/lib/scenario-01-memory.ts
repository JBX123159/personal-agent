import type { Memory, VehicleContext } from "@/domain/agent";

function isActive(memory: Memory | undefined): memory is Memory {
  return memory?.status === "active";
}

function matchesRoutineContext(context: VehicleContext): boolean {
  const isFriday = /friday|周五/i.test(context.currentTime);
  const isOffice = /office|公司|办公室/i.test(context.location);
  return isFriday && isOffice;
}

export function isScenario01Input(input: string): boolean {
  return input.replace(/[\s。！？!?]/g, "") === "今晚还是老样子吧";
}

export function selectScenario01Memories(
  context: VehicleContext,
  memories: Memory[],
): Memory[] {
  const selected: Memory[] = [];

  if (matchesRoutineContext(context)) {
    const gym = memories.find((memory) => memory.id === "friday_gym");
    const restaurant = memories.find(
      (memory) => memory.id === "friday_restaurant",
    );
    if (isActive(gym)) selected.push(gym);
    if (isActive(restaurant)) selected.push(restaurant);
  }

  const energy = memories.find(
    (memory) => memory.id === "low_battery_energy",
  );
  if (context.batteryLevel < 20 && isActive(energy)) selected.push(energy);

  const climate = memories.find(
    (memory) => memory.id === "summer_climate_24",
  );
  if (
    context.passengerMode === "owner_only" &&
    isActive(climate) &&
    climate.userConfirmed
  ) {
    selected.push(climate);
  }

  return selected.slice(0, 5);
}
