/**
 * Skeleton — shimmer block that matches a real component's footprint. Compose
 * these to mirror a card's exact layout; never a spinner for shaped content.
 */
export default function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-lg bg-gradient-to-r from-void-700 via-void-600 to-void-700 bg-[length:200%_100%] ${className}`}
    />
  )
}

/** A card-shaped skeleton matching the project/result card footprint. */
export function CardSkeleton({ ratio = 'aspect-[9/16]' }: { ratio?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-void-700 p-0">
      <Skeleton className={`w-full ${ratio} rounded-none`} />
      <div className="space-y-2 p-3.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-2.5 w-1/2" />
      </div>
    </div>
  )
}
