// ============================================
// WindLift Type Definitions
// ============================================

export type UserRole = 'ADMIN' | 'PROJECT_MANAGER' | 'FIELD_ENGINEER' | 'OPERATOR' | 'CLIENT'

export type ProjectStatus = 'planning' | 'mobilization' | 'active' | 'completing' | 'completed' | 'on_hold'

export type TurbineComponentStatus = 'pending' | 'in_progress' | 'completed'

export type ActivityType =
  | 'tower_section_1'
  | 'tower_section_2'
  | 'tower_section_3'
  | 'tower_section_4'
  | 'nacelle'
  | 'hub'
  | 'blade_1'
  | 'blade_2'
  | 'blade_3'

export type ActivityStatus = 'planned' | 'ready' | 'in_progress' | 'completed' | 'cancelled' | 'weather_hold'

export type CraneType = 'mobile' | 'crawler' | 'rough_terrain' | 'truck'

export type CraneStatus = 'available' | 'mobilizing' | 'on_site' | 'working' | 'demobilizing' | 'maintenance'

export type CrewType = 'installation' | 'electrical' | 'commissioning' | 'transport'

export type WeatherSource = 'api' | 'manual'

export type DowntimeReason = 'weather' | 'crane_breakdown' | 'material_delay' | 'other'

// ============================================
// Database Row Types
// ============================================

export interface Organization {
  id: string
  name: string
  logo_url: string | null
  settings: Record<string, unknown>
  created_at: string
}

export interface Profile {
  id: string
  org_id: string
  full_name: string
  role: UserRole
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
}

export interface TowerSection {
  name: string
  weight: number
  height: number
  diameter_bottom: number
  diameter_top: number
}

export interface TurbineModel {
  id: string
  manufacturer: string
  model: string
  rated_power_mw: number
  rotor_diameter: number
  nacelle_weight: number
  hub_weight: number
  blade_weight: number
  blade_count: number
  tower_sections: TowerSection[]
  max_wind_nacelle: number
  max_wind_blade: number
  max_wind_tower: number
  spec_sheet_url: string | null
  created_at: string
}

export interface Project {
  id: string
  org_id: string
  name: string
  client_name: string | null
  location_name: string | null
  latitude: number | null
  longitude: number | null
  total_turbines: number
  turbine_model_id: string | null
  hub_height: number | null
  status: ProjectStatus
  start_date: string | null
  target_end_date: string | null
  actual_end_date: string | null
  notes: string | null
  created_at: string
  // Joined
  turbine_model?: TurbineModel
}

export interface Turbine {
  id: string
  project_id: string
  turbine_number: string
  latitude: number | null
  longitude: number | null
  foundation_status: TurbineComponentStatus
  tower_status: TurbineComponentStatus
  nacelle_status: TurbineComponentStatus
  hub_status: TurbineComponentStatus
  blades_status: TurbineComponentStatus
  commissioning_status: TurbineComponentStatus
  foundation_date: string | null
  tower_complete_date: string | null
  nacelle_date: string | null
  hub_date: string | null
  blades_complete_date: string | null
  commissioning_date: string | null
  notes: string | null
  created_at: string
}

export interface Activity {
  id: string
  turbine_id: string
  project_id: string
  activity_type: ActivityType
  component_weight: number | null
  lift_height: number | null
  lift_radius: number | null
  crane_id: string | null
  planned_date: string | null
  planned_start_time: string | null
  actual_date: string | null
  actual_start_time: string | null
  actual_end_time: string | null
  status: ActivityStatus
  wind_speed_at_lift: number | null
  weather_notes: string | null
  crew_lead_id: string | null
  crew_members: string[]
  photos: string[]
  checklist: Record<string, unknown> | null
  notes: string | null
  created_at: string
}

export interface Crane {
  id: string
  org_id: string
  name: string
  crane_type: CraneType | null
  manufacturer: string | null
  model: string | null
  max_capacity: number | null
  max_boom_length: number | null
  max_tip_height: number | null
  current_project_id: string | null
  status: CraneStatus
  current_location: string | null
  daily_rate: number | null
  mobilization_cost: number | null
  load_chart_data: Record<string, unknown> | null
  notes: string | null
  created_at: string
}

export interface Crew {
  id: string
  org_id: string
  name: string
  crew_type: CrewType | null
  leader_id: string | null
  members: string[]
  current_project_id: string | null
  status: string
  created_at: string
}

export interface WeatherLog {
  id: string
  project_id: string
  timestamp: string
  wind_speed: number | null
  wind_gust: number | null
  wind_direction: number | null
  temperature: number | null
  humidity: number | null
  precipitation: number | null
  visibility: number | null
  source: WeatherSource
  created_at: string
}

export interface DailyReport {
  id: string
  project_id: string
  report_date: string
  reported_by: string
  weather_summary: string | null
  work_performed: string | null
  issues: string | null
  next_day_plan: string | null
  working_hours: number | null
  downtime_hours: number | null
  downtime_reason: DowntimeReason | null
  photos: string[]
  created_at: string
}

// ============================================
// UI / Helper Types
// ============================================

export interface WindWindow {
  startHour: number
  endHour: number
  status: 'green' | 'yellow' | 'red'
  avgWindSpeed: number
}

export interface GoNoGo {
  canProceed: boolean
  status: 'go' | 'marginal' | 'no_go'
  reason: string
  windows: WindWindow[]
}

export interface NavItem {
  label: string
  href: string
  icon: string
  roles?: UserRole[]
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planlama',
  mobilization: 'Mobilizasyon',
  active: 'Aktif',
  completing: 'Tamamlanıyor',
  completed: 'Tamamlandı',
  on_hold: 'Beklemede',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Yönetici',
  PROJECT_MANAGER: 'Proje Müdürü',
  FIELD_ENGINEER: 'Saha Mühendisi',
  OPERATOR: 'Operatör',
  CLIENT: 'Müşteri',
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  tower_section_1: 'Kule Bölüm 1',
  tower_section_2: 'Kule Bölüm 2',
  tower_section_3: 'Kule Bölüm 3',
  tower_section_4: 'Kule Bölüm 4',
  nacelle: 'Nacelle',
  hub: 'Hub',
  blade_1: 'Kanat 1',
  blade_2: 'Kanat 2',
  blade_3: 'Kanat 3',
}

export const CRANE_STATUS_LABELS: Record<CraneStatus, string> = {
  available: 'Müsait',
  mobilizing: 'Mobilizasyon',
  on_site: 'Sahada',
  working: 'Çalışıyor',
  demobilizing: 'Demobilizasyon',
  maintenance: 'Bakımda',
}
