export const LATEST_PROMO_BUNDLE_STORAGE_KEY = "mornstack.latestPromoBundle"

export type PromoBundleInput = {
  productName: string
  websiteUrl: string
  audience: string
  highlights: string[]
  references: string
}

export type PromoBundleData = {
  brandLine: string
  campaignTitle: string
  launchNarrative: string
  visualDirection: string
  videoScript: {
    title: string
    totalDurationSec: number
    scenes: Array<{
      title: string
      durationSec: number
      visualCue: string
      visual: string
      voiceover: string
    }>
  }
  pptDeck: {
    title: string
    slides: Array<{
      slideTitle: string
      slideGoal: string
      visualCue: string
      bullets: string[]
      presenterNote: string
    }>
  }
}

export type StoredPromoBundle = {
  generatedAt: string
  generator: string
  input: PromoBundleInput
  bundle: PromoBundleData
}
