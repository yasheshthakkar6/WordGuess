"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import FormField from "../components/FormField";

const LoginSchema = Yup.object({
  username: Yup.string().trim().required("Username is required"),
  password: Yup.string().required("Password is required"),
});

export default function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200">
        <h1 className="mb-1 text-center text-2xl font-bold text-zinc-900">Word Guesser</h1>
        <p className="mb-6 text-center text-sm text-zinc-500">Log in to keep your streak going</p>

        <Formik
          initialValues={{ username: "", password: "" }}
          validationSchema={LoginSchema}
          onSubmit={async (values, { setSubmitting }) => {
            try {
              await login(values.username, values.password);
              router.push("/");
            } catch (err) {
              showToast(err.message || "Login failed");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="flex flex-col gap-4">
              <FormField label="Username" name="username" type="text" autoComplete="username" />
              <FormField label="Password" name="password" type="password" autoComplete="current-password" />

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                {isSubmitting ? "Logging in..." : "Log In"}
              </button>
            </Form>
          )}
        </Formik>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-emerald-600 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
