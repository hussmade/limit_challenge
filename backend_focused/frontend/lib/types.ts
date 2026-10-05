export interface Row {
  id: number;
  [key: string]: unknown;
}
export interface Office extends Row {
  name: string;
  city: string;
}
export interface Mechanic extends Row {
  name: string;
  certification_number: string;
  active: boolean;
}
export interface Vehicle extends Row {
  vin: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  office: number;
  office_detail: Office;
  active: boolean;
  last_maintenance: string | null;
  maintenance_history?: Maintenance[];
}
export interface Maintenance extends Row {
  vehicle: number;
  vehicle_label: string;
  mechanic: number;
  mechanic_detail: Mechanic;
  maintenance_date: string;
  maintenance_type: string;
  cost: string;
  notes: string;
}
export interface OfficeSummary extends Office {
  active_vehicle_count: number;
  maintenance_cost_last_year: string;
  last_maintenance: string | null;
}
export interface Workload extends Mechanic {
  maintenance_count: number;
  total_cost: string;
}
export const vehicleLabel = (v: Vehicle) => `${v.make} ${v.model} · ${v.license_plate}`;
export type Resource = 'vehicles' | 'offices' | 'mechanics' | 'maintenance';
