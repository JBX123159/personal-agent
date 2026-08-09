import type { Memory, ToolName, ToolStatus, VehicleContext } from "@/domain/agent";

export const initialVehicleContext: VehicleContext = {
  currentTime: "Friday 17:40",
  location: "Office",
  batteryLevel: 19,
  passengerMode: "owner_only",
  cabinTemperature: 31,
  weather: "晴，32℃",
  currentRoute: "",
};

export const mockMemories: Memory[] = [
  {
    id: "friday_gym",
    type: "routine",
    content: "周五下班通常先去健身",
    context: { day: "Friday", location: "Office" },
    confidence: 0.96,
    sensitivity: "low",
    source: "repeated_behavior",
    status: "active",
    userConfirmed: true,
    observationCount: 3,
  },
  {
    id: "friday_restaurant",
    type: "routine",
    content: "健身后通常去 A 餐厅",
    context: { after: "gym" },
    confidence: 0.91,
    sensitivity: "low",
    source: "repeated_behavior",
    status: "active",
    userConfirmed: true,
    observationCount: 3,
  },
  {
    id: "summer_climate_24",
    type: "preference",
    content: "夏季独自驾驶时偏好 24℃",
    context: { passengerMode: "owner_only", season: "summer" },
    confidence: 0.98,
    sensitivity: "low",
    source: "explicit",
    status: "active",
    userConfirmed: true,
    observationCount: 3,
  },
  {
    id: "low_battery_energy",
    type: "preference",
    content: "电量低于 20% 时通常考虑补能",
    context: { batteryBelow: 20 },
    confidence: 0.9,
    sensitivity: "low",
    source: "repeated_behavior",
    status: "active",
    userConfirmed: true,
    observationCount: 3,
  },
];

export function createMockMemories(): Memory[] {
  return mockMemories.map((memory) => ({
    ...memory,
    context: memory.context ? { ...memory.context } : undefined,
  }));
}

export const toolNames: ToolName[] = [
  "getVehicleState",
  "setClimateTemperature",
  "setNavigation",
  "searchEnergyStation",
  "searchRestaurant",
];

export const initialToolStatuses: Record<ToolName, ToolStatus> = {
  getVehicleState: "SUCCESS",
  setClimateTemperature: "SUCCESS",
  setNavigation: "SUCCESS",
  searchEnergyStation: "SUCCESS",
  searchRestaurant: "SUCCESS",
};

export const toolLabels: Record<ToolName, string> = {
  getVehicleState: "读取车辆状态",
  setClimateTemperature: "设置座舱温度",
  setNavigation: "设置导航",
  searchEnergyStation: "查询补能站",
  searchRestaurant: "查询餐厅",
};
