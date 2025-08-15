"use client"

import { useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, Search, Train, MapPin } from "lucide-react"
import { StationSearch } from "./station-search"
import { CoachSelection } from "./coach-selection"
import { useRouter } from "next/navigation"

interface TrainResult {
  id: string
  name: string
  number: string
  from_station: string
  to_station: string
  code_from_to?: string
  code_to_from?: string
  direction?: string
  search_direction?: string
  display_code?: string
}

interface Props {
  trainId?: string
  onSearch: (params: {
    fromStation: string
    toStation: string
    coach?: string
  }) => void
}

export function TrainDirectionSearch({ trainId, onSearch }: Props) {
  const router = useRouter()
  const [searchType, setSearchType] = useState<"route" | "train">("route")
  const [fromStation, setFromStation] = useState("")
  const [toStation, setToStation] = useState("")
  const [selectedCoach, setSelectedCoach] = useState("")
  const [trainQuery, setTrainQuery] = useState("")
  const [results, setResults] = useState<TrainResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showStationSearch, setShowStationSearch] = useState<"from" | "to" | null>(null)
  const [showCoachSelection, setShowCoachSelection] = useState(false)

  const getCorrectTrainNumber = (train: TrainResult) => {
    // The WordPress API already provides the correct display_code for each direction
    return train.display_code || train.number || train.id
  }

  const getDisplayStations = (train: TrainResult) => {
    if (searchType === "train" && trainQuery) {
      // Determine direction based on which route code matches the search query
      if (train.code_to_from === trainQuery) {
        // User searched for the reverse direction code, so swap the stations
        return {
          from: train.to_station,
          to: train.from_station,
        }
      } else {
        // User searched for forward direction code or train name, use normal direction
        return {
          from: train.from_station,
          to: train.to_station,
        }
      }
    }

    if (searchType === "route") {
      return {
        from: fromStation,
        to: toStation,
      }
    }

    return {
      from: train.from_station,
      to: train.to_station,
    }
  }

  const handleSearch = useCallback(async () => {
    if (searchType === "route" && (!fromStation || !toStation)) {
      setError("Please select both departure and destination stations")
      return
    }
    if (searchType === "train" && !trainQuery.trim()) {
      setError("Please enter a train name or number")
      return
    }

    setLoading(true)
    setError("")

    try {
      let url = ""
      if (searchType === "route") {
        url = `/api/trains/search?from=${encodeURIComponent(fromStation)}&to=${encodeURIComponent(toStation)}`
        if (selectedCoach) {
          url += `&coach=${encodeURIComponent(selectedCoach)}`
        }
      } else {
        url = `/api/trains/search?query=${encodeURIComponent(trainQuery.trim())}`
        if (selectedCoach) {
          url += `&coach=${encodeURIComponent(selectedCoach)}`
        }
      }

      console.log("[v0] Search URL:", url)

      const response = await fetch(url)
      if (!response.ok) throw new Error("Search failed")

      const data = await response.json()
      console.log("[v0] Search response:", data)

      const formattedResults =
        data.trains?.map((train: any) => ({
          id: train.id,
          name: train.name,
          number: train.number || train.id || train.train_number || String(train.id),
          from_station:
            typeof train.from_station === "object"
              ? train.from_station?.title || train.from_station?.name
              : train.from_station,
          to_station:
            typeof train.to_station === "object" ? train.to_station?.title || train.to_station?.name : train.to_station,
          code_from_to: train.code_from_to,
          code_to_from: train.code_to_from,
          direction: train.direction,
          search_direction: train.search_direction,
          display_code: train.display_code,
        })) || []

      setResults(formattedResults)

      if (!formattedResults.length) {
        const coachMessage = selectedCoach ? ` with coach ${selectedCoach}` : ""
        setError(`No trains found${coachMessage}. Please try different search criteria.`)
      }
    } catch (error) {
      setError("Unable to search trains. Please check your connection and try again.")
      console.error("[v0] Search failed:", error)
    } finally {
      setLoading(false)
    }
  }, [searchType, fromStation, toStation, trainQuery, selectedCoach]) // Add selectedCoach to dependencies

  const swapStations = useCallback(() => {
    setFromStation(toStation)
    setToStation(fromStation)
    setError("")
  }, [fromStation, toStation])

  const canSearch = useMemo(() => {
    return searchType === "route" ? fromStation && toStation : trainQuery.trim().length > 0
  }, [searchType, fromStation, toStation, trainQuery])

  const handleStationSelect = useCallback(
    (station: string) => {
      if (showStationSearch === "from") {
        setFromStation(station)
      } else {
        setToStation(station)
      }
      setShowStationSearch(null)
      setError("")
    },
    [showStationSearch],
  )

  const handleCoachSelect = useCallback((coach: string) => {
    setSelectedCoach(coach)
    setShowCoachSelection(false)
  }, [])

  if (showStationSearch) {
    return <StationSearch onSelect={handleStationSelect} onBack={() => setShowStationSearch(null)} />
  }

  if (showCoachSelection) {
    return (
      <CoachSelection
        fromStation={fromStation}
        toStation={toStation}
        trainId={trainId}
        onSelect={handleCoachSelect}
        onBack={() => setShowCoachSelection(false)}
      />
    )
  }

  if (results.length > 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Available Trains</h2>
            <p className="text-sm text-gray-600 mt-1">
              {searchType === "route" ? `${fromStation} → ${toStation}` : `Search: ${trainQuery}`}
            </p>
            {selectedCoach && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500">Filtered by coach:</span>
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                  <span>{selectedCoach}</span>
                  <button
                    onClick={() => setSelectedCoach("")}
                    className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                    title="Remove coach filter"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setResults([])
              setError("")
            }}
            className="text-blue-700 hover:bg-blue-50 border-blue-200 font-medium rounded-lg"
          >
            New Search
          </Button>
        </div>

        <div className="space-y-3">
          {results.map((train, index) => {
            const displayStations = getDisplayStations(train)
            const routeCode =
              train.display_code || train.search_direction === "reverse" ? train.code_to_from : train.code_from_to
            const uniqueKey = `${train.id}-${routeCode || train.number || index}-${train.search_direction || "default"}-${index}`

            return (
              <div key={uniqueKey}>
                <div className="bg-white rounded-lg p-5 border border-gray-200 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">{train.name.toUpperCase()}</h3>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                        #{getCorrectTrainNumber(train)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-5">
                    <div className="text-center flex-1">
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-medium">From</div>
                      <div className="font-semibold text-gray-900 text-sm">{displayStations.from}</div>
                    </div>

                    <div className="flex-1 flex items-center justify-center px-4">
                      <div className="text-center">
                        <div className="w-16 h-0.5 bg-blue-200 mb-2 relative">
                          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full"></div>
                          <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full"></div>
                        </div>
                      </div>
                    </div>

                    <div className="text-center flex-1">
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-medium">To</div>
                      <div className="font-semibold text-gray-900 text-sm">{displayStations.to}</div>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      const actualTrainId = train.id // WordPress post ID
                      const routeCode = train.display_code || train.number || train.id // Route code like "103"

                      console.log("[v0] Fetching train data for:", { actualTrainId, routeCode })

                      if (!actualTrainId || !routeCode) {
                        console.error("[v0] Missing train ID or route code for navigation:", train)
                        return
                      }

                      const params = new URLSearchParams({
                        from: String(displayStations.from),
                        to: String(displayStations.to),
                        trainName: String(train.name),
                      })
                      if (selectedCoach) {
                        params.append("coach", selectedCoach)
                      }

                      // Use new API structure: /trains/{trainId}/route/{routeCode}
                      router.push(`/trains/${actualTrainId}/route/${routeCode}?${params.toString()}`)
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors"
                  >
                    <Train className="w-4 h-4 mr-2" />
                    View Seat Map
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
        <button
          onClick={() => {
            setSearchType("route")
            setError("")
          }}
          className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
            searchType === "route" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-blue-600"
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <MapPin className="w-4 h-4" />
            <span>By Route</span>
          </div>
        </button>
        <button
          onClick={() => {
            setSearchType("train")
            setError("")
          }}
          className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
            searchType === "train" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-blue-600"
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <Train className="w-4 h-4" />
            <span>By Train</span>
          </div>
        </button>
      </div>

      <div className="space-y-5">
        {error && (
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-red-700 text-sm font-medium">{error}</p>
          </div>
        )}

        {searchType === "route" ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Station</label>
              <button
                onClick={() => setShowStationSearch("from")}
                className="w-full p-4 text-left rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:border-blue-500 focus:outline-none transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${fromStation ? "text-gray-900" : "text-gray-500"}`}>
                    {fromStation || "Select departure station"}
                  </span>
                  <MapPin className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                </div>
              </button>
            </div>

            <div className="flex justify-center">
              <button
                onClick={swapStations}
                disabled={!fromStation && !toStation}
                className="p-3 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowUpDown className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Station</label>
              <button
                onClick={() => setShowStationSearch("to")}
                className="w-full p-4 text-left rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:border-blue-500 focus:outline-none transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${toStation ? "text-gray-900" : "text-gray-500"}`}>
                    {toStation || "Select destination station"}
                  </span>
                  <MapPin className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                </div>
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Coach (Optional)</label>
              {selectedCoach ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCoachSelection(true)}
                    className="flex-1 p-4 text-left rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:border-blue-500 focus:outline-none transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{selectedCoach}</span>
                      <div className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors">▼</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedCoach("")}
                    className="p-4 hover:bg-gray-200 rounded-lg transition-colors border border-gray-200"
                    title="Clear coach selection"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCoachSelection(true)}
                  className="w-full p-4 text-left rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:border-blue-500 focus:outline-none transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-500">Select coach (optional)</span>
                    <div className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors">▼</div>
                  </div>
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">Train Name or Number</label>
              <input
                type="text"
                placeholder="e.g., Ekota, 101, 103"
                value={trainQuery}
                onChange={(e) => {
                  setTrainQuery(e.target.value)
                  setError("")
                }}
                className="w-full p-4 pl-12 rounded-lg bg-gray-50 border border-gray-200 focus:border-blue-500 focus:outline-none transition-colors"
              />
              <Train className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Coach (Optional)</label>
              {selectedCoach ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCoachSelection(true)}
                    className="flex-1 p-4 text-left rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:border-blue-500 focus:outline-none transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{selectedCoach}</span>
                      <div className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors">▼</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedCoach("")}
                    className="p-4 hover:bg-gray-200 rounded-lg transition-colors border border-gray-200"
                    title="Clear coach selection"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCoachSelection(true)}
                  className="w-full p-4 text-left rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:border-blue-500 focus:outline-none transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-500">Select coach (optional)</span>
                    <div className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors">▼</div>
                  </div>
                </button>
              )}
            </div>
          </>
        )}

        <Button
          onClick={handleSearch}
          disabled={loading || !canSearch}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Searching...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <Search className="w-4 h-4" />
              <span>Find Seat Directions</span>
            </div>
          )}
        </Button>
      </div>
    </div>
  )
}
