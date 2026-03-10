import { z } from "zod";

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email должен быть в формате name@example.com")
  .max(254, "Email слишком длинный");

export const PasswordSchema = z
  .string()
  .min(8, "Пароль должен быть минимум 8 символов")
  .max(200, "Пароль слишком длинный");

export const RegisterSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

export const LoginSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});
