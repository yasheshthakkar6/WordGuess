"use client";

import { useField } from "formik";

export default function FormField({ label, ...props }) {
  const [field, meta] = useField(props);
  const showError = meta.touched && meta.error;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={props.id || props.name} className="text-sm font-medium text-zinc-700">
        {label}
      </label>
      <input
        {...field}
        {...props}
        id={props.id || props.name}
        className={`rounded-lg border px-3 py-2 text-sm text-black outline-none transition-colors focus:ring-2 focus:ring-emerald-400 ${
          showError ? "border-red-500" : "border-zinc-300"
        }`}
      />
      {showError && <span className="text-xs text-red-600">{meta.error}</span>}
    </div>
  );
}
