import { z } from "zod";

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .email(
      "Enter a valid email address."
    ),

  password: z
    .string()
    .min(
      8,
      "Password must contain at least 8 characters."
    )
    .max(
      128,
      "Password must contain at most 128 characters."
    ),
});

export type SignInInput = z.infer<
  typeof signInSchema
>;

export const signUpSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(
        2,
        "Name must contain at least 2 characters."
      )
      .max(
        100,
        "Name must contain at most 100 characters."
      ),

    email: z
      .string()
      .trim()
      .email(
        "Enter a valid email address."
      ),

    password: z
      .string()
      .min(
        8,
        "Password must contain at least 8 characters."
      )
      .max(
        128,
        "Password must contain at most 128 characters."
      ),

    confirmPassword: z.string(),
  })
  .refine(
    (values) =>
      values.password ===
      values.confirmPassword,
    {
      message:
        "The passwords do not match.",
      path: ["confirmPassword"],
    }
  );

export type SignUpInput = z.infer<
  typeof signUpSchema
>;

// Keep compatibility with any older imports.
export type signUpInput =
  SignUpInput;