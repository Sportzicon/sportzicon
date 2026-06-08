export interface UserRecord {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  dob?: string | null;
  gender?: string | null;
  athlete_data?: Record<string, unknown> | null;
  coach_data?: Record<string, unknown> | null;
}

export interface IUserRepository {
  findById(id: string, select?: Record<string, boolean>): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  updateAthleteData(userId: string, data: Record<string, unknown>): Promise<void>;
}
