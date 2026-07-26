"use client"

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronsLeftRight } from "lucide-react"

type ImageComparisonSliderProps = {
  // Original image, revealed on the RIGHT side of the divider.
  beforeSrc: string
  // Generated image, fills the container and shows on the LEFT side of the divider.
  afterSrc: string
  altBefore?: string
  altAfter?: string
  // Initial divider position as a percentage (0-100). Defaults to 50.
  initialPosition?: number
  className?: string
  // When true, the slider automatically animates from 0% to 100% once on
  // mount (duration 1.5 s). User interaction cancels the animation.
  autoPlay?: boolean
}

const MIN_POSITION = 0
const MAX_POSITION = 100
const KEYBOARD_STEP = 1
const KEYBOARD_LARGE_STEP = 10
const AUTOPLAY_DURATION_MS = 1500
// 60 fps target → ~16.67 ms per frame
const AUTOPLAY_FRAME_MS = 17

// Overlapping before/after comparison slider. The before image is
// clipped to the RIGHT of the divider; the after image fills the container underneath.
// Dragging from left to right reveals the generated image progressively
// (original -> generated), matching the autoPlay 0 -> 100 direction.
export function ImageComparisonSlider({
  beforeSrc,
  afterSrc,
  altBefore = "Before",
  altAfter = "After",
  initialPosition = 50,
  className,
  autoPlay = false,
}: ImageComparisonSliderProps) {
  // Start at 0 when autoPlay is on so the full original image is visible first.
  const [sliderPosition, setSliderPosition] = useState(() => clampPosition(autoPlay ? 0 : initialPosition))
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const autoPlayCancelledRef = useRef(false)

  // -------------------------------------------------------------------
  // Auto-play: animate from 0% → 100% over AUTOPLAY_DURATION_MS once on
  // mount. User interaction (pointer / keyboard) cancels the animation.
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!autoPlay) return
    autoPlayCancelledRef.current = false
    const startTime = performance.now()

    function tick(now: number) {
      if (autoPlayCancelledRef.current) return
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / AUTOPLAY_DURATION_MS)
      setSliderPosition(clampPosition(progress * MAX_POSITION))
      if (progress < 1) {
        requestAnimationFrame(tick)
      }
    }
    const rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [autoPlay])

  const cancelAutoPlay = useCallback(() => {
    autoPlayCancelledRef.current = true
  }, [])

  const updatePositionFromClientX = useCallback((clientX: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    if (rect.width <= 0) return
    const next = ((clientX - rect.left) / rect.width) * 100
    setSliderPosition(clampPosition(next))
  }, [])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    // Only react to primary pointer to avoid right-click interference.
    if (event.button !== 0 && event.pointerType === "mouse") return
    event.preventDefault()
    cancelAutoPlay()
    setIsDragging(true)
    updatePositionFromClientX(event.clientX)
  }, [cancelAutoPlay, updatePositionFromClientX])

  // Global listeners ensure dragging keeps working when the pointer leaves the
  // component, and reliably resets the dragging state on release.
  useEffect(() => {
    if (!isDragging) return
    const handleMove = (event: PointerEvent) => {
      updatePositionFromClientX(event.clientX)
    }
    const handleUp = () => {
      setIsDragging(false)
    }
    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    window.addEventListener("pointercancel", handleUp)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      window.removeEventListener("pointercancel", handleUp)
    }
  }, [isDragging, updatePositionFromClientX])

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    cancelAutoPlay()
    let delta = 0
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        delta = -KEYBOARD_STEP
        break
      case "ArrowRight":
      case "ArrowUp":
        delta = KEYBOARD_STEP
        break
      case "PageDown":
      case "Home":
        delta = -KEYBOARD_LARGE_STEP
        break
      case "PageUp":
      case "End":
        delta = KEYBOARD_LARGE_STEP
        break
      default:
        return
    }
    event.preventDefault()
    setSliderPosition((current) => clampPosition(current + delta))
  }, [cancelAutoPlay])

  const handleClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    // Prevent the slider interaction from triggering ancestor click handlers
    // (e.g. the mobile media card toggles image controls on click).
    event.stopPropagation()
  }, [])

  return (
    <div
      ref={containerRef}
      className={["compare-slider", isDragging ? "is-dragging" : "", className].filter(Boolean).join(" ")}
      style={{ "--slider-position": `${sliderPosition}%` } as CSSProperties}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      {/* Bottom layer: generated image fills the whole container; visible on
          the LEFT of the divider. */}
      <img
        className="compare-slider-after compare-slider-layer"
        src={afterSrc}
        alt={altAfter}
        draggable={false}
      />
      {/* Top layer: original image clipped to the RIGHT of the divider.
          Dragging right shrinks the original and exposes the generated image
          on the left (original -> generated). */}
      <img
        className="compare-slider-before compare-slider-layer"
        src={beforeSrc}
        alt={altBefore}
        draggable={false}
      />
      {/* Divider line + grip handle. */}
      <div
        className="compare-slider-handle"
        role="slider"
        tabIndex={0}
        aria-label="Comparison divider"
        aria-valuemin={MIN_POSITION}
        aria-valuemax={MAX_POSITION}
        aria-valuenow={Math.round(sliderPosition)}
        onKeyDown={handleKeyDown}
      >
        <span className="compare-slider-grip">
          <ChevronsLeftRight size={18} />
        </span>
      </div>
    </div>
  )
}

function clampPosition(value: number) {
  return Math.max(MIN_POSITION, Math.min(MAX_POSITION, value))
}
