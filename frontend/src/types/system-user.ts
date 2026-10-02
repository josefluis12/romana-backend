export type SystemUserRole = "administrator" | "dispatch_driver";

export interface SystemUser {
  userId: string;
  name: string;
  email: string;
  role: SystemUserRole;
}

export type SystemUserLogCategory = "online_order" | "baguio_sale" | "baguio_sale_revision";

export interface SystemUserLog {
  id: string;
  category: SystemUserLogCategory;
  action: string;
  referenceNumber: string;
  createdAt: string;
}

export interface SystemUserProfile extends SystemUser {
  createdAt: string;
  lastSignInAt: string | null;
  logs: SystemUserLog[];
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
