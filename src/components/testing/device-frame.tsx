"use client";

import { cn } from "@/lib/utils";
import type { DevicePreset } from "@/lib/devices/presets";

export function DeviceFrame({
  device,
  scale,
  orientation,
  children,
  className,
  label,
}: {
  device: Pick<DevicePreset, "name" | "width" | "height" | "category">;
  scale: number;
  orientation: "portrait" | "landscape";
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  const w = orientation === "portrait" ? device.width : device.height;
  const h = orientation === "portrait" ? device.height : device.width;
  const isMobile = device.category === "phone" || device.category === "foldable";

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="text-center">
        <div className="text-xs font-medium">{label || device.name}</div>
        <div className="text-[10px] text-[var(--muted-foreground)]">
          {w}×{h} CSS · {Math.round(scale * 100)}%
        </div>
      </div>
      <div
        className="device-frame p-2"
        style={{
          width: w * scale + (isMobile ? 16 : 16),
          borderRadius: isMobile ? 24 : 12,
        }}
      >
        {isMobile && (
          <div className="mx-auto mb-1 h-1.5 w-16 rounded-full bg-[var(--border)]" />
        )}
        <div
          className="device-screen relative"
          style={{
            width: w * scale,
            height: h * scale,
            borderRadius: isMobile ? 16 : 6,
          }}
        >
          <div
            style={{
              width: w,
              height: h,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            className="absolute left-0 top-0"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
