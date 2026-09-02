"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

import {
  signUpSchema,
  type signUpInput,
} from "../schema";

export function SignUpForm(){
  const form=useForm<signUpInput>({
    resolver:zodResolver(signUpSchema),
    defaultValues:{
      name:"",
      email:"",
      password:"",
      confirmPassword:"",
    },
  });
  
  const router=useRouter();
  async function onSubmit(values: signUpInput) {
  const result = await authClient.signUp.email({
    name: values.name,
    email: values.email,
    password: values.password,
  });

  console.log(result);

    if (!result.error) {
    router.push("/dashboard");
  }
}

  return(
  
    <form 
    onSubmit={form.handleSubmit(onSubmit)}
    className="space-y-4 w-full max-w-md">
      
      <input
  className="w-full rounded-md border px-3 py-2"
  placeholder="Name"
  {...form.register("name")}
/>
      <input
       className="w-full rounded-md border px-3 py-2"
        placeholder="Email"
        {...form.register("email")}
      />

      <input
       className="w-full rounded-md border px-3 py-2"
        type="password"
        placeholder="Password"
        {...form.register("password")}
      />

      <input
        type="password"
         className="w-full rounded-md border px-3 py-2"
        placeholder="Confirm Password"
        {...form.register("confirmPassword")}
      />  
       <button type="submit" 
       className="w-full rounded-md bg-black py-2 text-white">
        Create Account
      </button>
    </form>
  );
}