/**
 * Legacy auth store — now delegates to the centralized authService.
 * Kept for backward compatibility with existing components.
 */

import { authService } from '../authService';

export const authStore = {
  async login(username: string, password: string) {
    const response = await authService.login(username, password);
    return response.user;
  },

  async logout() {
    await authService.logout();
  },

  async getCurrentUser() {
    return await authService.fetchCurrentUser();
  }
};
