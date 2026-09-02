"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { signInSchema, type SignInInput } from "../schema";

export function SignInForm() {
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const router=useRouter();

  async function onSubmit(values: SignInInput) {
    const result = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });

    console.log(result);

      if (!result.error) {
    router.push("/dashboard");
  }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4 w-full max-w-md"
    >
      <input
        className="w-full rounded-md border px-3 py-2"
        placeholder="Email"
        {...form.register("email")}
      />

      <input
        type="password"
        className="w-full rounded-md border px-3 py-2"
        placeholder="Password"
        {...form.register("password")}
      />

      <button
        type="submit"
        className="w-full rounded-md bg-black py-2 text-white"
      >
        Sign In
      </button>
    </form>
  );
}