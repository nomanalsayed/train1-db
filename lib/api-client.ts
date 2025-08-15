import { API_CONFIG } from "./config"

const BASE_URL = typeof window !== "undefined" ? window.location.origin : API_CONFIG.BASE_URL

export interface Train {
  id: number
  name: string
  number: string
  reverseNumber: string
  route: string
  fromStation: Station
  toStation: Station
}

export interface Station {
  id: number
  title: string
  code: string
}

export interface TrainDetail {
  id: number
  name: string
  fromStation: Station
  toStation: Station
  codeFromTo: string
  codeToFrom: string
  route: RouteStation[]
  coaches: Coach[]
}

export interface RouteStation {
  station: Station
}

export interface Coach {
  id: number
  code: string
  name?: string
  type?: string
  totalSeats: number
  frontFacingSeats: number[]
  backFacingSeats: number[]
}

export async function searchTrains(query?: string, from?: string, to?: string): Promise<Train[]> {
  const params = new URLSearchParams()
  if (query) params.append("query", query)
  if (from) params.append("from", from)
  if (to) params.append("to", to)

  const response = await fetch(`${BASE_URL}/api/trains/search?${params}`)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || "Failed to search trains")
  }

  const data = await response.json()
  return data.trains || []
}

export class ApiClient {
  static async searchTrains(query?: string, from?: string, to?: string): Promise<Train[]> {
    return searchTrains(query, from, to)
  }

  static async getTrainDetail(trainId: string, from?: string, to?: string): Promise<any> {
    const params = new URLSearchParams()
    if (from) params.append("from", from)
    if (to) params.append("to", to)

    const response = await fetch(`${BASE_URL}/api/trains/${trainId}/detail?${params}`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || "Failed to get train details")
    }

    return response.json()
  }

  static async getStations(): Promise<Station[]> {
    const response = await fetch(`${BASE_URL}/api/stations`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || "Failed to get stations")
    }

    const data = await response.json()
    return data.stations || []
  }

  static async getCoaches(): Promise<{ id: number; code: string; name: string }[]> {
    const response = await fetch(`${BASE_URL}/api/coaches`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || "Failed to get coaches")
    }

    const data = await response.json()
    return data.coaches || []
  }

  static async getTrainCoaches(
    trainId: string,
  ): Promise<{ id: number; code: string; name: string; totalSeats: number }[]> {
    const response = await fetch(`${BASE_URL}/api/trains/${trainId}/coaches`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || "Failed to get train coaches")
    }

    const data = await response.json()
    return data.coaches || []
  }

  static async getCoachDetails(coachId: string): Promise<any> {
    const response = await fetch(`${BASE_URL}/api/coaches/${coachId}`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || "Failed to get coach details")
    }

    return response.json()
  }
}
