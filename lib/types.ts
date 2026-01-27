export type ScheduleCategory = "food" | "activity" | "transport" | "accommodation" | "other"

export interface Trip {
  id: string
  title: string
  destination: string
  startDate: string
  endDate: string
  preDays: number
  postDays: number
  startViewDay: number
  orderIndex: number
  imageUrl?: string
}

export interface Schedule {
  id: string
  tripId: string
  dayNumber: number
  time: string
  endTime: string
  title: string
  location: string
  memo: string
  category: ScheduleCategory
  subCategory: string
  amount: number
  currency: string
  arrivalPlace: string
  reservationNum: string
  bookingSource: string
}

export interface DayInfo {
  id: string
  tripId: string
  dayNumber: number
  city: string
  accommodation: string
  checkInDay: string
  checkInTime: string
  checkOutDay: string
  checkOutTime: string
}

export interface ExchangeRate {
  currency: string
  rateToKRW: number
}

export interface ChecklistCategory {
  id: string
  tripId: string
  title: string
  sortOrder: number
}

export interface ChecklistItem {
  id: string
  categoryId: string
  name: string
  isCountable: boolean
  isChecked: boolean
  currentCount: number
  targetCount: number
  sortOrder: number
}

export interface DayView {
  dayNumber: number
  date: string
  weekday: string
  schedules: Schedule[]
}

export interface TripFormData {
  title: string
  destination: string
  startDate: string
  endDate: string
}

export interface ScheduleFormData {
  time: string
  endTime: string
  title: string
  location: string
  memo: string
  category: ScheduleCategory
  subCategory: string
  arrivalPlace: string
  reservationNum: string
  bookingSource: string
}

export interface BudgetFormData {
  dayNumber: number
  time: string
  endTime: string
  title: string
  memo: string
  category: ScheduleCategory
  subCategory: string
  amount: number
  currency: string
}
