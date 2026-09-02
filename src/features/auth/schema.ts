import {z} from "zod";

export const signUpSchema=z.object({
    name:z.string().min(2,"Name must be of at least 3 characters"),
    email:z.email("Please Enter a valid Email"),
    password:z.string().min(8,"Password Must Be Of 8 Characters"),
    confirmPassword:z.string(),
})
.refine((data)=>data.password==data.confirmPassword,{
    message:"Passwords do not match",
    path:["confirmPassword"],
});

export const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});


export type signUpInput=z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;