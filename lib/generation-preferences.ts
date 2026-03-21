"use client"

import {
  getDefaultDatabaseTarget,
  getDefaultDeploymentTarget,
  type DatabaseTarget,
  type DeploymentTarget,
} from "@/lib/fullstack-targets"

export type GenerationRegion = "cn" | "intl"

export type GenerationPreferences = {
  region: GenerationRegion
  deploymentTarget: DeploymentTarget
  databaseTarget: DatabaseTarget
}

const STORAGE_KEY = "mornfullstack-generation-preferences"
const EVENT_NAME = "mornfullstack:generation-preferences"

export function getDefaultGenerationPreferences(region: GenerationRegion): GenerationPreferences {
  return {
    region,
    deploymentTarget: getDefaultDeploymentTarget(region),
    databaseTarget: getDefaultDatabaseTarget(region),
  }
}

export function loadGenerationPreferences(fallbackRegion: GenerationRegion): GenerationPreferences {
  const fallback = getDefaultGenerationPreferences(fallbackRegion)
  if (typeof window === "undefined") return fallback

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<GenerationPreferences>
    const region = parsed.region === "cn" || parsed.region === "intl" ? parsed.region : fallback.region
    return {
      region,
      deploymentTarget: (parsed.deploymentTarget as DeploymentTarget | undefined) ?? getDefaultDeploymentTarget(region),
      databaseTarget: (parsed.databaseTarget as DatabaseTarget | undefined) ?? getDefaultDatabaseTarget(region),
    }
  } catch {
    return fallback
  }
}

export function saveGenerationPreferences(preferences: GenerationPreferences) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: preferences }))
}

export function subscribeGenerationPreferences(listener: (preferences: GenerationPreferences) => void) {
  if (typeof window === "undefined") return () => {}

  const handleStorage = () => {
    listener(loadGenerationPreferences("intl"))
  }
  const handleCustom = (event: Event) => {
    const detail = (event as CustomEvent<GenerationPreferences>).detail
    if (detail) {
      listener(detail)
      return
    }
    listener(loadGenerationPreferences("intl"))
  }

  window.addEventListener("storage", handleStorage)
  window.addEventListener(EVENT_NAME, handleCustom)

  return () => {
    window.removeEventListener("storage", handleStorage)
    window.removeEventListener(EVENT_NAME, handleCustom)
  }
}
