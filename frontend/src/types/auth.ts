export interface AuthenticatedUser {
  email: string;
  name: string;
  csrfToken: string;
}
