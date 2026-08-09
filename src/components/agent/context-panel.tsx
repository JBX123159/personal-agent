"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { VehicleContext } from "@/domain/agent";

interface ContextPanelProps {
  context: VehicleContext;
  disabled: boolean;
  onChange: (context: VehicleContext) => void;
  onReset: () => void;
}

export function ContextPanel({
  context,
  disabled,
  onChange,
  onReset,
}: ContextPanelProps) {
  function updateText(field: keyof VehicleContext, value: string) {
    onChange({ ...context, [field]: value });
  }

  function updateNumber(
    field: "batteryLevel" | "cabinTemperature",
    value: string,
    min: number,
    max: number,
  ) {
    if (value.trim() === "") return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    onChange({ ...context, [field]: Math.min(max, Math.max(min, parsed)) });
  }

  const inputClass =
    "border-white/10 bg-white/[0.04] text-slate-100 focus-visible:border-cyan-400/60 focus-visible:ring-cyan-400/15";

  return (
    <Card className="h-full border-white/10 bg-slate-950/75 text-slate-100 shadow-2xl shadow-black/20 backdrop-blur">
      <CardHeader className="border-b border-white/8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-cyan-300" />
              Vehicle Context
            </CardTitle>
            <CardDescription className="mt-1 text-slate-400">
              手动调整实时座舱状态
            </CardDescription>
          </div>
          <Button
            aria-label="恢复 Scenario 01 默认 Context"
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={onReset}
            className="text-slate-400 hover:bg-white/8 hover:text-white"
          >
            <RotateCcw />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        <ContextField label="Current Time" htmlFor="current-time">
          <Input
            id="current-time"
            value={context.currentTime}
            disabled={disabled}
            onChange={(event) => updateText("currentTime", event.target.value)}
            className={inputClass}
          />
        </ContextField>
        <ContextField label="Location" htmlFor="location">
          <Input
            id="location"
            value={context.location}
            disabled={disabled}
            onChange={(event) => updateText("location", event.target.value)}
            className={inputClass}
          />
        </ContextField>
        <div className="grid grid-cols-2 gap-3">
          <ContextField label="Battery" htmlFor="battery-level" suffix="%">
            <Input
              id="battery-level"
              type="number"
              min={0}
              max={100}
              value={context.batteryLevel}
              disabled={disabled}
              onChange={(event) =>
                updateNumber("batteryLevel", event.target.value, 0, 100)
              }
              className={inputClass}
            />
          </ContextField>
          <ContextField label="Cabin" htmlFor="cabin-temperature" suffix="℃">
            <Input
              id="cabin-temperature"
              type="number"
              min={-20}
              max={60}
              value={context.cabinTemperature}
              disabled={disabled}
              onChange={(event) =>
                updateNumber("cabinTemperature", event.target.value, -20, 60)
              }
              className={inputClass}
            />
          </ContextField>
        </div>
        <ContextField label="Passenger Mode" htmlFor="passenger-mode">
          <select
            id="passenger-mode"
            value={context.passengerMode}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...context,
                passengerMode: event.target.value as VehicleContext["passengerMode"],
              })
            }
            className="h-8 w-full rounded-lg border border-white/10 bg-slate-900 px-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400/60"
          >
            <option value="owner_only">Owner Only</option>
            <option value="guest">Guest</option>
          </select>
        </ContextField>
        <ContextField label="Weather" htmlFor="weather">
          <Input
            id="weather"
            value={context.weather}
            disabled={disabled}
            onChange={(event) => updateText("weather", event.target.value)}
            className={inputClass}
          />
        </ContextField>
        <ContextField label="Current Route" htmlFor="current-route">
          <Input
            id="current-route"
            value={context.currentRoute ?? ""}
            placeholder="暂无路线"
            disabled={disabled}
            onChange={(event) => updateText("currentRoute", event.target.value)}
            className={inputClass}
          />
        </ContextField>
        <p className="rounded-lg border border-cyan-400/10 bg-cyan-400/5 p-3 text-xs leading-5 text-slate-400">
          修改 Context 后重新运行，Mock Decision 会按确定性规则重新判断。
        </p>
      </CardContent>
    </Card>
  );
}

function ContextField({
  label,
  htmlFor,
  suffix,
  children,
}: {
  label: string;
  htmlFor: string;
  suffix?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-xs font-medium text-slate-400">
          {label}
        </label>
        {suffix ? <span className="text-xs text-slate-600">{suffix}</span> : null}
      </div>
      {children}
    </div>
  );
}
