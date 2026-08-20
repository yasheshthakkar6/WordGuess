"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import FormField from "../components/FormField";

const RegisterSchema = Yup.object({
  first_name: Yup.string().trim().required("First name is required"),
  last_name: Yup.string().trim().required("Last name is required"),
  email: Yup.string().trim().email("Enter a valid email").required("Email is required"),
  username: Yup.string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(60, "Username must be under 60 characters")
    .required("Username is required"),
  password: Yup.string().min(8, "Password must be at least 8 characters").required("Password is required"),
  password2: Yup.string()
    .oneOf([Yup.ref("password")], "Passwords do not match")
    .required("Please confirm your password"),
});

export default function RegisterPage() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200">
        <h1 className="mb-1 text-center text-2xl font-bold text-zinc-900">Create an account</h1>
        <p className="mb-6 text-center text-sm text-zinc-500">Track your streaks and stats</p>

        <Formik
          initialValues={{
            first_name: "",
            last_name: "",
            email: "",
            username: "",
            password: "",
            password2: "",
          }}
          validationSchema={RegisterSchema}
          onSubmit={async (values, { setSubmitting }) => {
            try {
              await register(values);
              router.push("/login");
            } catch (err) {
              showToast(err.message || "Registration failed");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="First name" name="first_name" type="text" autoComplete="given-name" />
                <FormField label="Last name" name="last_name" type="text" autoComplete="family-name" />
              </div>
              <FormField label="Email" name="email" type="email" autoComplete="email" />
              <FormField label="Username" name="username" type="text" autoComplete="username" />
              <FormField label="Password" name="password" type="password" autoComplete="new-password" />
              <FormField label="Confirm password" name="password2" type="password" autoComplete="new-password" />

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                {isSubmitting ? "Creating account..." : "Register"}
              </button>
            </Form>
          )}
        </Formik>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-emerald-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
