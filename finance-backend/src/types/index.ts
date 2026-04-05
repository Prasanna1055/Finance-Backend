export type Role = "admin" | "analyst" | "viewer";
export type UserStatus = "active" | "inactive";

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export type SafeUser = Omit<User, "password_hash">;

export interface AuthPayload {
  userId: number;
  email: string;
  role: Role;
}


export type RecordType = "income" | "expense";

export interface FinancialRecord {
  id: number;
  user_id: number;
  amount: number;           
  type: RecordType;
  category: string;
  date: string;            
  notes: string | null;
  deleted_at: string | null; 
  created_at: string;
  updated_at: string;
}

export interface FinancialRecordDTO {
  id: number;
  user_id: number;
  amount: number;   
  type: RecordType;
  category: string;
  date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}


export interface CategoryTotal {
  category: string;
  type: RecordType;
  total: number;
}

export interface MonthlyTrend {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  net: number;
}

export interface DashboardSummary {
  total_income: number;
  total_expenses: number;
  net_balance: number;
  category_totals: CategoryTotal[];
  monthly_trends: MonthlyTrend[];
  recent_activity: FinancialRecordDTO[];
}


export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  };
}


export interface RecordFilters {
  type?: RecordType;
  category?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  page_size?: number;
}
