import type { AxiosInstance } from "axios";
import type { User } from "../../../models";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  access_token: string;
}

export class AuthService {
  constructor(private readonly client: AxiosInstance) {}

  async login(data: LoginRequest): Promise<LoginResponse> {
    const res = await this.client.post<LoginResponse>("/auth/login", data);
    return res.data;
  }

  async logout(): Promise<void> {
    await this.client.post("/auth/logout");
  }

  async resendVerification(email: string): Promise<void> {
    await this.client.post("/auth/resend-verification", { email });
  }

  async forgotPassword(email: string): Promise<void> {
    await this.client.post("/auth/forgot-password", { email });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await this.client.post("/auth/reset-password", { token, password });
  }
}
