interface AdSlotProps {
  placement: "banner" | "sidebar";
}

export default function AdSlot({ placement }: AdSlotProps) {
  return (
    <div
      className={`rounded-lg border border-dashed border-border bg-secondary/30 flex items-center justify-center text-xs text-muted-foreground ${
        placement === "banner" ? "h-20 w-full" : "h-64 w-full"
      }`}
    >
      Ad Space — {placement}
    </div>
  );
}
