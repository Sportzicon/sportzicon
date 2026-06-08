import type { AxiosInstance } from "axios";
import type { User, UpdateAthleteRequest } from "../models";

export class UserService {
  constructor(private readonly client: AxiosInstance) {}

  async get(id: string): Promise<User> {
    const res = await this.client.get<{ user: User }>(`/users/${id}`);
    return res.data.user;
  }

  async updateAthleteProfile(data: UpdateAthleteRequest): Promise<User> {
    const res = await this.client.put<{ user: User }>("/users/me/athlete", data);
    return res.data.user;
  }

  async follow(userId: string): Promise<void> {
    await this.client.post(`/users/${userId}/follow`);
  }

  async unfollow(userId: string): Promise<void> {
    await this.client.delete(`/users/${userId}/follow`);
  }
}
