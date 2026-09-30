export type SystemUserRole = "administrator" | "dispatch_driver";

export interface SystemUser {
  userId: string;
  name: string;
  email: string;
  role: SystemUserRole;
}

export interface CreateSystemUserInput {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  role: SystemUserRole;
  password: string;
  passwordConfirmation: string;
}
