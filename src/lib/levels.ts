/**
 * Level curve. Kept isolated so the formula can change without touching UI.
 * Default: L1→2 needs 100 EXP, then +20 per level (120, 140, …).
 */
export interface LevelCurve {
  base: number
  step: number
}

export interface LevelInfo {
  level: number
  xpIntoLevel: number
  xpForNext: number
  progress: number // 0..1
  totalXp: number
}

export function xpToAdvance(level: number, curve: LevelCurve): number {
  return Math.max(1, curve.base + curve.step * (level - 1))
}

export function levelFromXp(totalXp: number, curve: LevelCurve): LevelInfo {
  let level = 1
  let remaining = Math.max(0, Math.floor(totalXp))
  // Bounded loop: guards against a pathological curve.
  for (let i = 0; i < 10_000; i++) {
    const need = xpToAdvance(level, curve)
    if (remaining < need) break
    remaining -= need
    level++
  }
  const xpForNext = xpToAdvance(level, curve)
  return { level, xpIntoLevel: remaining, xpForNext, progress: remaining / xpForNext, totalXp }
}
