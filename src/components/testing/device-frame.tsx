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
  scrollable = false,
}: {
  device: Pick<DevicePreset, "name" | "width" | "height" | "category">;
  scale: number;
  orientation: "portrait" | "landscape";
  children: React.ReactNode;
  className?: string;
  label?: string;
  /** When true, content taller than the device height can be scrolled inside the frame. */
  scrollable?: boolean;
}) {
  const w = orientation === "portrait" ? device.width : device.height;
  const h = orientation === "portrait" ? device.height : device.width;
  const isMobile = device.category === "phone" || device.category === "foldable";
  const frameW = w * scale;
  const frameH = h * scale;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="text-center">
        <div className="text-xs font-medium">{label || device.name}</div>
        <div className="text-[10px] text-[var(--muted-foreground)]">
          {w}×{h} CSS · {Math.round(scale * 100)}%
          {scrollable ? " · scroll inside" : ""}
        </div>
      </div>
      <div
        className="device-frame p-2"
        style={{
          width: frameW + 16,
          borderRadius: isMobile ? 24 : 12,
        }}
      >
        {isMobile && (
          <div className="mx-auto mb-1 h-1.5 w-16 rounded-full bg-[var(--border)]" />
        )}
        {scrollable ? (
          <div
            className="device-screen overflow-y-auto overflow-x-hidden overscroll-contain bg-white"
            style={{
              width: frameW,
              height: frameH,
              borderRadius: isMobile ? 16 : 6,
            }}
          >
            {children}
          </div>
        ) : (
          <div
            className="device-screen relative overflow-hidden"
            style={{
              width: frameW,
              height: frameH,
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
        )}
      </div>
    </div>
  );
}
