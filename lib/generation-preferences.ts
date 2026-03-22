"use client"

import {
  getDefaultDatabaseTarget,
  getDefaultDeploymentTarget,
  type DatabaseTarget,
  type DeploymentTarget,
} from "@/lib/fullstack-targets"
import { getRegionFromHostname, type AppRegion } from "@/lib/region-routing"

export type GenerationRegion = AppRegion

export type GenerationPreferences = {
  region: GenerationRegion
  deploymentTarget: DeploymentTarget
  databaseTarget: DatabaseTarget
}

const STORAGE_KEY = "mornfullstack-generation-preferences"
const EVENT_NAME = "mornfullstack:generation-preferences"

export function getCurrentDomainRegion(fallbackRegion: GenerationRegion = "intl"): GenerationRegion {
  if (typeof window === "undefined") return fallbackRegion
  const detected = getRegionFromHostname(window.location.hostname)
  return detected || fallbackRegion
}

export function getDefaultGenerationPreferences(region: GenerationRegion): GenerationPreferences {
  return {
    region,
    deploymentTarget: getDefaultDeploymentTarget(region),
    databaseTarget: getDefaultDatabaseTarget(region),
  }
}

export function loadGenerationPreferences(fallbackRegion: GenerationRegion): GenerationPreferences {
  const lockedRegion = getCurrentDomainRegion(fallbackRegion)
  const fallback = getDefaultGenerationPreferences(lockedRegion)
  if (typeof window === "undefined") return fallback

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<GenerationPreferences>
    const parsedRegion = parsed.region === "cn" || parsed.region === "intl" ? parsed.region : lockedRegion
    const region = lockedRegion
    const useStoredTargets = parsedRegion === lockedRegion
    return {
      region,
      deploymentTarget: useStoredTargets
        ? (parsed.deploymentTarget as DeploymentTarget | undefined) ?? getDefaultDeploymentTarget(region)
        : getDefaultDeploymentTarget(region),
      databaseTarget: useStoredTargets
        ? (parsed.databaseTarget as DatabaseTarget | undefined) ?? getDefaultDatabaseTarget(region)
        : getDefaultDatabaseTarget(region),
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
