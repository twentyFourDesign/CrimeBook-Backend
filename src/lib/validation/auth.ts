import { UserRole } from "@prisma/client";
import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.nativeEnum(UserRole).optional(),
});

export const verifySignupOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const passwordLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const otpRequestSchema = z.object({
  email: z.string().email(),
});

export const otpVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(16),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(16),
});
