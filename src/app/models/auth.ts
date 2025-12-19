export interface SignupRequest {
  email: string;
  password: string;
  confirmPassword?: string;
  fullName?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}
