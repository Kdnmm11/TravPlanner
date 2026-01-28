"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type {
  Trip,
  Schedule,
  DayInfo,
  ExchangeRate,
  ChecklistCategory,
  ChecklistItem,
  DayView,
  TripFormData,
  ScheduleFormData,
  BudgetFormData,
} from "./types"

interface TravelStore {
  trips: Trip[]
  schedules: Schedule[]
  dayInfos: DayInfo[]
  exchangeRates: ExchangeRate[]
  checklistCategories: ChecklistCategory[]
  checklistItems: ChecklistItem[]
  selectedTripId: string | null
  activeShares: Record<string, { shareId: string; enabled: boolean }>

  // Trip actions
  addTrip: (trip: TripFormData) => void
  updateTrip: (id: string, updates: Partial<Trip>) => void
  deleteTrip: (id: string) => void
  selectTrip: (id: string | null) => void
  setActiveShare: (tripId: string, shareId: string, enabled: boolean) => void
  setActiveShareEnabled: (tripId: string, enabled: boolean) => void
  clearActiveShare: (tripId: string) => void

  // Schedule actions
  addSchedule: (tripId: string, dayNumber: number, schedule: ScheduleFormData) => void
  updateSchedule: (tripId: string, dayNumber: number, scheduleId: string, updates: Partial<Schedule>) => void
  deleteSchedule: (tripId: string, dayNumber: number, scheduleId: string) => void

  // Day info actions
  updateDayInfo: (tripId: string, dayNumber: number, updates: Partial<DayInfo>) => void

  // Budget actions
  addBudgetItem: (tripId: string, data: BudgetFormData) => void

  // Exchange rate actions
  setExchangeRate: (currency: string, rateToKRW: number) => void

  // Checklist actions
  addChecklistCategory: (tripId: string, title: string) => void
  updateChecklistCategory: (id: string, updates: Partial<ChecklistCategory>) => void
  deleteChecklistCategory: (id: string) => void
  addChecklistItem: (
    categoryId: string,
    name: string,
    isCountable: boolean,
    targetCount?: number
  ) => void
  updateChecklistItem: (id: string, updates: Partial<ChecklistItem>) => void
  deleteChecklistItem: (id: string) => void
  toggleChecklistItem: (id: string) => void
  updateChecklistItemCount: (id: string, delta: number) => void
  addChecklistPreset: (tripId: string) => void
  exportTripData: (tripId: string) => {
    version: number
    trip: Trip
    schedules: Schedule[]
    dayInfos: DayInfo[]
    checklistCategories: ChecklistCategory[]
    checklistItems: ChecklistItem[]
    exchangeRates: ExchangeRate[]
  } | null
  replaceTripData: (payload: {
    trip: Trip
    schedules: Schedule[]
    dayInfos: DayInfo[]
    checklistCategories: ChecklistCategory[]
    checklistItems: ChecklistItem[]
    exchangeRates: ExchangeRate[]
  }) => void
  importTripData: (payload: {
    version?: number
    trip: Trip
    schedules?: Schedule[]
    dayInfos?: DayInfo[]
    checklistCategories?: ChecklistCategory[]
    checklistItems?: ChecklistItem[]
    exchangeRates?: ExchangeRate[]
  }) => string | null

  // Derived views
  getTripDays: (tripId: string) => DayView[]
}

function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

const defaultExchangeRates: ExchangeRate[] = [
  { currency: "KRW", rateToKRW: 1 },
  { currency: "USD", rateToKRW: 1460 },
  { currency: "EUR", rateToKRW: 1700 },
  { currency: "JPY", rateToKRW: 9.3 },
  { currency: "CNY", rateToKRW: 209 },
  { currency: "GBP", rateToKRW: 1960 },
  { currency: "CHF", rateToKRW: 1820 },
  { currency: "CAD", rateToKRW: 1050 },
  { currency: "AUD", rateToKRW: 980 },
  { currency: "HKD", rateToKRW: 187 },
  { currency: "TWD", rateToKRW: 46 },
  { currency: "THB", rateToKRW: 46.5 },
  { currency: "VND", rateToKRW: 0.056 },
  { currency: "PHP", rateToKRW: 24.6 },
]

function buildDayViews(trip: Trip, schedules: Schedule[]): DayView[] {
  const start = new Date(trip.startDate)
  start.setDate(start.getDate() - trip.preDays)
  const end = new Date(trip.endDate)
  end.setDate(end.getDate() + trip.postDays)
  const days: DayView[] = []
  const weekdays = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]
  
  let dayNumber = 1 - trip.preDays
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push({
      dayNumber,
      date: `${d.getMonth() + 1}월 ${d.getDate()}일`,
      weekday: weekdays[d.getDay()],
      schedules: schedules
        .filter((schedule) => schedule.tripId === trip.id && schedule.dayNumber === dayNumber)
        .sort((a, b) => a.time.localeCompare(b.time)),
    })
    dayNumber++
  }
  
  return days
}

const storeVersion = 1

type LegacySchedule = {
  id?: string
  time: string
  title: string
  location: string
  category: "food" | "activity" | "transport" | "accommodation"
}

type LegacyDay = {
  dayNumber: number
  schedules: LegacySchedule[]
}

type LegacyTrip = {
  id: string
  name: string
  destination: string
  startDate: string
  endDate: string
  days: LegacyDay[]
  imageUrl?: string
}

function migrateLegacyState(state: any) {
  if (!state || !Array.isArray(state.trips)) return undefined

  const hasLegacyTrips = state.trips.some((trip: LegacyTrip) => "name" in trip || "days" in trip)
  if (!hasLegacyTrips) return undefined

  const migratedTrips: Trip[] = state.trips.map((trip: LegacyTrip, index: number) => ({
    id: trip.id || generateId(),
    title: trip.name || "새 여행",
    destination: trip.destination || "",
    startDate: trip.startDate || "",
    endDate: trip.endDate || "",
    preDays: 0,
    postDays: 0,
    startViewDay: 1,
    orderIndex: index + 1,
    imageUrl: trip.imageUrl,
  }))

  const scheduleBuckets: Schedule[] = []

  state.trips.forEach((trip: LegacyTrip, index: number) => {
    const tripId = migratedTrips[index].id
    trip.days?.forEach((day) => {
      day.schedules?.forEach((schedule) => {
        scheduleBuckets.push({
          id: schedule.id || generateId(),
          tripId,
          dayNumber: day.dayNumber,
          time: schedule.time,
          endTime: "",
          title: schedule.title,
          location: schedule.location,
          memo: "",
          category: schedule.category,
          subCategory: "",
          amount: 0,
          currency: "KRW",
          arrivalPlace: "",
          reservationNum: "",
          bookingSource: "",
        })
      })
    })
  })

  return {
    trips: migratedTrips,
    schedules: scheduleBuckets,
    dayInfos: [],
    exchangeRates: defaultExchangeRates,
    checklistCategories: [],
    checklistItems: [],
    selectedTripId: migratedTrips[0]?.id ?? null,
  }
}

export const useTravelStore = create<TravelStore>()(
  persist(
    (set, get) => ({
      trips: [],
      schedules: [],
      dayInfos: [],
      exchangeRates: defaultExchangeRates,
      checklistCategories: [],
      checklistItems: [],
      selectedTripId: null,
      activeShares: {},

      addTrip: (tripData) =>
        set((state) => {
          const maxOrder = Math.max(0, ...state.trips.map((trip) => trip.orderIndex))
          const newTrip: Trip = {
            id: generateId(),
            title: tripData.title,
            destination: tripData.destination,
            startDate: tripData.startDate,
            endDate: tripData.endDate,
            preDays: 0,
            postDays: 0,
            startViewDay: 1,
            orderIndex: maxOrder + 1,
          }
          return {
            trips: [...state.trips, newTrip],
            selectedTripId: newTrip.id,
          }
        }),

      updateTrip: (id, updates) =>
        set((state) => ({
          trips: state.trips.map((trip) => (trip.id === id ? { ...trip, ...updates } : trip)),
        })),

      deleteTrip: (id) =>
        set((state) => {
          const remainingTrips = state.trips.filter((trip) => trip.id !== id)
          const remainingCategories = state.checklistCategories.filter((category) => category.tripId !== id)
          return {
            trips: remainingTrips,
            schedules: state.schedules.filter((schedule) => schedule.tripId !== id),
            dayInfos: state.dayInfos.filter((info) => info.tripId !== id),
            checklistCategories: remainingCategories,
            checklistItems: state.checklistItems.filter((item) =>
              remainingCategories.some((category) => category.id === item.categoryId)
            ),
            selectedTripId:
              state.selectedTripId === id ? (remainingTrips[0]?.id ?? null) : state.selectedTripId,
          }
        }),

      selectTrip: (id) => set({ selectedTripId: id }),
      setActiveShare: (tripId, shareId, enabled) =>
        set((state) => ({
          activeShares: {
            ...state.activeShares,
            [tripId]: { shareId, enabled },
          },
        })),
      setActiveShareEnabled: (tripId, enabled) =>
        set((state) => ({
          activeShares: state.activeShares[tripId]
            ? {
                ...state.activeShares,
                [tripId]: {
                  ...state.activeShares[tripId],
                  enabled,
                },
              }
            : state.activeShares,
        })),
      clearActiveShare: (tripId) =>
        set((state) => {
          const next = { ...state.activeShares }
          delete next[tripId]
          return { activeShares: next }
        }),

      addSchedule: (tripId, dayNumber, schedule) =>
        set((state) => ({
          schedules: [
            ...state.schedules,
            {
              id: generateId(),
              tripId,
              dayNumber,
              time: schedule.time,
              endTime: schedule.endTime,
              title: schedule.title,
              location: schedule.location,
              memo: schedule.memo,
              category: schedule.category,
              subCategory: schedule.subCategory,
              amount: 0,
              currency: "KRW",
              arrivalPlace: schedule.arrivalPlace,
              reservationNum: schedule.reservationNum,
              bookingSource: schedule.bookingSource,
            },
          ],
        })),

      updateSchedule: (tripId, dayNumber, scheduleId, updates) =>
        set((state) => ({
          schedules: state.schedules.map((schedule) =>
            schedule.id === scheduleId && schedule.tripId === tripId && schedule.dayNumber === dayNumber
              ? { ...schedule, ...updates }
              : schedule
          ),
        })),

      deleteSchedule: (tripId, dayNumber, scheduleId) =>
        set((state) => ({
          schedules: state.schedules.filter(
            (schedule) =>
              !(
                schedule.id === scheduleId &&
                schedule.tripId === tripId &&
                schedule.dayNumber === dayNumber
              )
          ),
        })),

      updateDayInfo: (tripId, dayNumber, updates) =>
        set((state) => {
          const parseDayNumber = (value: string) => {
            const match = value.match(/\d+/)
            if (!match) return null
            const number = Number.parseInt(match[0], 10)
            return Number.isFinite(number) ? number : null
          }

          const dayInfos = [...state.dayInfos]
          const index = dayInfos.findIndex((info) => info.tripId === tripId && info.dayNumber === dayNumber)
          const baseInfo: DayInfo =
            index >= 0
              ? dayInfos[index]
              : {
                  id: generateId(),
                  tripId,
                  dayNumber,
                  city: "",
                  accommodation: "",
                  checkInDay: "",
                  checkInTime: "",
                  checkOutDay: "",
                  checkOutTime: "",
                }

          const nextInfo = { ...baseInfo, ...updates }
          if (index >= 0) {
            dayInfos[index] = nextInfo
          } else {
            dayInfos.push(nextInfo)
          }

          const startDay = parseDayNumber(nextInfo.checkInDay)
          const endDay = parseDayNumber(nextInfo.checkOutDay)
          if (startDay !== null && endDay !== null && startDay < endDay && nextInfo.accommodation.trim()) {
            for (let i = startDay; i < endDay; i += 1) {
              if (i === dayNumber) continue
              const targetIndex = dayInfos.findIndex((info) => info.tripId === tripId && info.dayNumber === i)
              const targetInfo: DayInfo =
                targetIndex >= 0
                  ? dayInfos[targetIndex]
                  : {
                      id: generateId(),
                      tripId,
                      dayNumber: i,
                      city: "",
                      accommodation: "",
                      checkInDay: "",
                      checkInTime: "",
                      checkOutDay: "",
                      checkOutTime: "",
                    }

              const syncedInfo = {
                ...targetInfo,
                accommodation: nextInfo.accommodation,
                checkInDay: nextInfo.checkInDay,
                checkInTime: nextInfo.checkInTime,
                checkOutDay: nextInfo.checkOutDay,
                checkOutTime: nextInfo.checkOutTime,
              }

              if (targetIndex >= 0) {
                dayInfos[targetIndex] = syncedInfo
              } else {
                dayInfos.push(syncedInfo)
              }
            }
          }

          return { dayInfos }
        }),

      addBudgetItem: (tripId, data) =>
        set((state) => ({
          schedules: [
            ...state.schedules,
            {
              id: generateId(),
              tripId,
              dayNumber: data.dayNumber,
              time: data.time,
              endTime: data.endTime,
              title: data.title,
              location: "",
              memo: data.memo,
              category: data.category,
              subCategory: data.subCategory,
              amount: data.amount,
              currency: data.currency,
              arrivalPlace: "",
              reservationNum: "",
              bookingSource: "",
            },
          ],
        })),

      setExchangeRate: (currency, rateToKRW) =>
        set((state) => {
          const existing = state.exchangeRates.find((rate) => rate.currency === currency)
          if (existing) {
            return {
              exchangeRates: state.exchangeRates.map((rate) =>
                rate.currency === currency ? { currency, rateToKRW } : rate
              ),
            }
          }
          return { exchangeRates: [...state.exchangeRates, { currency, rateToKRW }] }
        }),

      addChecklistCategory: (tripId, title) =>
        set((state) => {
          const nextOrder =
            Math.max(
              0,
              ...state.checklistCategories
                .filter((category) => category.tripId === tripId)
                .map((category) => category.sortOrder)
            ) + 1
          return {
            checklistCategories: [
              ...state.checklistCategories,
              { id: generateId(), tripId, title, sortOrder: nextOrder },
            ],
          }
        }),

      updateChecklistCategory: (id, updates) =>
        set((state) => ({
          checklistCategories: state.checklistCategories.map((category) =>
            category.id === id ? { ...category, ...updates } : category
          ),
        })),

      deleteChecklistCategory: (id) =>
        set((state) => ({
          checklistCategories: state.checklistCategories.filter((category) => category.id !== id),
          checklistItems: state.checklistItems.filter((item) => item.categoryId !== id),
        })),

      addChecklistItem: (categoryId, name, isCountable, targetCount = 1) =>
        set((state) => {
          const nextOrder =
            Math.max(
              0,
              ...state.checklistItems
                .filter((item) => item.categoryId === categoryId)
                .map((item) => item.sortOrder)
            ) + 1
          return {
            checklistItems: [
              ...state.checklistItems,
              {
                id: generateId(),
                categoryId,
                name,
                isCountable,
                isChecked: false,
                currentCount: 0,
                targetCount: Math.max(1, targetCount),
                sortOrder: nextOrder,
              },
            ],
          }
        }),

      updateChecklistItem: (id, updates) =>
        set((state) => ({
          checklistItems: state.checklistItems.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        })),

      deleteChecklistItem: (id) =>
        set((state) => ({
          checklistItems: state.checklistItems.filter((item) => item.id !== id),
        })),

      toggleChecklistItem: (id) =>
        set((state) => ({
          checklistItems: state.checklistItems.map((item) =>
            item.id === id ? { ...item, isChecked: !item.isChecked } : item
          ),
        })),

      updateChecklistItemCount: (id, delta) =>
        set((state) => ({
          checklistItems: state.checklistItems.map((item) =>
            item.id === id
              ? {
                  ...item,
                  currentCount: Math.max(0, item.currentCount + delta),
                }
              : item
          ),
        })),

      addChecklistPreset: (tripId) =>
        set((state) => {
          const hasCategories = state.checklistCategories.some((category) => category.tripId === tripId)
          if (hasCategories) return { checklistCategories: state.checklistCategories, checklistItems: state.checklistItems }

          const presets = [
            {
              title: "필수준비물",
              items: [
                { name: "여권", isCountable: false },
                { name: "신분증/운전면허증", isCountable: false },
                { name: "항공권", isCountable: false },
                { name: "호텔/투어 바우처 인쇄물", isCountable: false },
                { name: "현금", isCountable: false },
                { name: "신용카드/트래블월렛", isCountable: false },
                { name: "보험증서", isCountable: false },
              ],
            },
            {
              title: "전자기기",
              items: [
                { name: "스마트폰", isCountable: false },
                { name: "유심/이심/도시락", isCountable: false },
                { name: "충전기/케이블", isCountable: false },
                { name: "멀티 어댑터", isCountable: false },
                { name: "보조배터리", isCountable: false },
                { name: "이어폰", isCountable: false },
              ],
            },
            {
              title: "의류",
              items: [
                { name: "상의", isCountable: true, targetCount: 3 },
                { name: "하의", isCountable: true, targetCount: 2 },
                { name: "속옷", isCountable: true, targetCount: 4 },
                { name: "양말", isCountable: true, targetCount: 4 },
                { name: "잠옷", isCountable: true, targetCount: 1 },
                { name: "외투/겉옷", isCountable: true, targetCount: 1 },
                { name: "슬리퍼", isCountable: false },
                { name: "모자", isCountable: false },
                { name: "선글라스", isCountable: false },
              ],
            },
            {
              title: "세면위생",
              items: [
                { name: "칫솔&치약", isCountable: false },
                { name: "세안용품/클렌징", isCountable: false },
                { name: "샴푸/린스/바디워시", isCountable: false },
                { name: "스킨케어(스킨/로션/수분크림)", isCountable: false },
                { name: "선크림", isCountable: false },
                { name: "면도기", isCountable: false },
                { name: "머리끈", isCountable: false },
                { name: "빗", isCountable: false },
                { name: "휴지/물티슈", isCountable: false },
                { name: "위생비닐", isCountable: false },
              ],
            },
            {
              title: "비상약",
              items: [
                { name: "개인 복용약", isCountable: false },
                { name: "진통해열제", isCountable: false },
                { name: "소염진통제", isCountable: false },
                { name: "소화제/지사제", isCountable: false },
                { name: "멀미약", isCountable: false },
                { name: "반창고", isCountable: false },
                { name: "알레르기약", isCountable: false },
              ],
            },
            {
              title: "여행용품",
              items: [
                { name: "목베개/안대/귀마개", isCountable: false },
                { name: "보조가방", isCountable: false },
                { name: "지퍼백/비닐", isCountable: false },
                { name: "우산/우비", isCountable: false },
              ],
            },
          ]

          const checklistCategories: ChecklistCategory[] = []
          const checklistItems: ChecklistItem[] = []

          presets.forEach((preset, categoryIndex) => {
            const categoryId = generateId()
            checklistCategories.push({
              id: categoryId,
              tripId,
              title: preset.title,
              sortOrder: categoryIndex + 1,
            })

            preset.items.forEach((item, itemIndex) => {
              checklistItems.push({
                id: generateId(),
                categoryId,
                name: item.name,
                isCountable: item.isCountable,
                isChecked: false,
                currentCount: 0,
                targetCount: item.isCountable ? Math.max(1, item.targetCount ?? 1) : 1,
                sortOrder: itemIndex + 1,
              })
            })
          })

          return {
            checklistCategories: [...state.checklistCategories, ...checklistCategories],
            checklistItems: [...state.checklistItems, ...checklistItems],
          }
        }),

      exportTripData: (tripId) => {
        const state = get()
        const trip = state.trips.find((item) => item.id === tripId)
        if (!trip) return null
        const checklistCategories = state.checklistCategories.filter(
          (category) => category.tripId === tripId
        )
        const categoryIds = new Set(checklistCategories.map((category) => category.id))
        const checklistItems = state.checklistItems.filter((item) => categoryIds.has(item.categoryId))
        return {
          version: 1,
          trip,
          schedules: state.schedules.filter((schedule) => schedule.tripId === tripId),
          dayInfos: state.dayInfos.filter((info) => info.tripId === tripId),
          checklistCategories,
          checklistItems,
          exchangeRates: state.exchangeRates,
        }
      },

      replaceTripData: (payload) =>
        set((state) => {
          const tripId = payload.trip.id
          const existingTrip = state.trips.find((item) => item.id === tripId)
          const trip = existingTrip ? { ...existingTrip, ...payload.trip } : payload.trip
          const existingCategoryIds = new Set(
            state.checklistCategories.filter((category) => category.tripId === tripId).map((category) => category.id)
          )

          return {
            trips: existingTrip
              ? state.trips.map((item) => (item.id === tripId ? trip : item))
              : [...state.trips, trip],
            schedules: [
              ...state.schedules.filter((schedule) => schedule.tripId !== tripId),
              ...payload.schedules,
            ],
            dayInfos: [
              ...state.dayInfos.filter((info) => info.tripId !== tripId),
              ...payload.dayInfos,
            ],
            checklistCategories: [
              ...state.checklistCategories.filter((category) => category.tripId !== tripId),
              ...payload.checklistCategories,
            ],
            checklistItems: [
              ...state.checklistItems.filter((item) => !existingCategoryIds.has(item.categoryId)),
              ...payload.checklistItems,
            ],
            exchangeRates: payload.exchangeRates.length ? payload.exchangeRates : state.exchangeRates,
          }
        }),

      importTripData: (payload) => {
        const state = get()
        if (!payload?.trip) return null
        const newTripId = generateId()
        const maxOrder =
          Math.max(0, ...state.trips.map((trip) => trip.orderIndex ?? 0)) + 1
          const trip: Trip = {
            ...payload.trip,
            id: newTripId,
            orderIndex: maxOrder,
          }

        const schedules = (payload.schedules ?? []).map((schedule) => ({
          ...schedule,
          id: generateId(),
          tripId: newTripId,
        }))

        const dayInfos = (payload.dayInfos ?? []).map((info) => ({
          ...info,
          id: generateId(),
          tripId: newTripId,
        }))

        const categoryIdMap = new Map<string, string>()
        const checklistCategories = (payload.checklistCategories ?? []).map((category) => {
          const newId = generateId()
          categoryIdMap.set(category.id, newId)
          return {
            ...category,
            id: newId,
            tripId: newTripId,
          }
        })

        const checklistItems = (payload.checklistItems ?? [])
          .filter((item) => categoryIdMap.has(item.categoryId))
          .map((item) => ({
            ...item,
            id: generateId(),
            categoryId: categoryIdMap.get(item.categoryId) ?? item.categoryId,
          }))

        const incomingRates = payload.exchangeRates ?? []
        const mergedRates = [...state.exchangeRates]
        incomingRates.forEach((rate) => {
          if (!mergedRates.some((item) => item.currency === rate.currency)) {
            mergedRates.push(rate)
          }
        })

        set(() => ({
          trips: [...state.trips, trip],
          schedules: [...state.schedules, ...schedules],
          dayInfos: [...state.dayInfos, ...dayInfos],
          checklistCategories: [...state.checklistCategories, ...checklistCategories],
          checklistItems: [...state.checklistItems, ...checklistItems],
          exchangeRates: mergedRates,
        }))

        return newTripId
      },

      getTripDays: (tripId) => {
        const state = get()
        const trip = state.trips.find((item) => item.id === tripId)
        if (!trip) return []
        return buildDayViews(trip, state.schedules)
      },
    }),
    {
      name: "trav-data",
      storage: createJSONStorage(() => localStorage),
      version: storeVersion,
      migrate: (persistedState) => {
        const migrated = migrateLegacyState(persistedState)
        if (migrated) return migrated
        const state = persistedState as any
        if (!state?.exchangeRates || state.exchangeRates.length === 0) {
          return { ...state, exchangeRates: defaultExchangeRates, activeShares: state.activeShares ?? {} }
        }
        if (!state?.activeShares) {
          return { ...state, activeShares: {} }
        }
        return state
      },
      partialize: (state) => ({
        trips: state.trips,
        schedules: state.schedules,
        dayInfos: state.dayInfos,
        exchangeRates: state.exchangeRates,
        checklistCategories: state.checklistCategories,
        checklistItems: state.checklistItems,
        selectedTripId: state.selectedTripId,
        activeShares: state.activeShares,
      }),
    }
  )
)
