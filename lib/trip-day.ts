import type { Trip } from "./types"

type TripDateRange = Pick<Trip, "startDate" | "endDate">
type TripDayContext = Pick<Trip, "startDate" | "endDate" | "preDays" | "postDays">

export function getBaseTripDayCount(trip: TripDateRange) {
  const start = new Date(trip.startDate)
  const end = new Date(trip.endDate)
  const diffTime = end.getTime() - start.getTime()
  return Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1)
}

export function formatTripDayLabel(dayNumber: number, trip: TripDateRange) {
  const baseTripDayCount = getBaseTripDayCount(trip)

  if (dayNumber <= 0) {
    return `Day ${dayNumber - 1}`
  }

  if (dayNumber > baseTripDayCount) {
    return `Day +${dayNumber - baseTripDayCount}`
  }

  return `Day ${dayNumber}`
}

export function parseTripDayLabel(label: string, trip: TripDateRange) {
  const match = label.trim().match(/^Day\s*([+-]?)(\d+)$/i)
  if (!match) return null

  const [, sign, digits] = match
  const value = Number.parseInt(digits, 10)
  if (!Number.isFinite(value)) return null

  if (sign === "-") {
    return 1 - value
  }

  if (sign === "+") {
    return getBaseTripDayCount(trip) + value
  }

  return value
}

export function getTripDayOptions(trip: TripDayContext) {
  const totalDays = getBaseTripDayCount(trip) + trip.preDays + trip.postDays

  return Array.from({ length: Math.max(1, totalDays) }, (_, index) => {
    const dayNumber = 1 - trip.preDays + index
    const baseTripDayCount = getBaseTripDayCount(trip)
    const isBeforeTrip = dayNumber <= 0
    const isAfterTrip = dayNumber > baseTripDayCount

    return {
      dayNumber,
      label: formatTripDayLabel(dayNumber, trip),
      isExtra: isBeforeTrip || isAfterTrip,
      isBeforeTrip,
      isAfterTrip,
    }
  })
}

export function getNextTripDayLabel(dayNumber: number, trip: TripDayContext) {
  const options = getTripDayOptions(trip)
  const currentIndex = options.findIndex((option) => option.dayNumber === dayNumber)
  if (currentIndex === -1) return formatTripDayLabel(dayNumber, trip)
  return options[Math.min(options.length - 1, currentIndex + 1)]?.label ?? formatTripDayLabel(dayNumber, trip)
}
