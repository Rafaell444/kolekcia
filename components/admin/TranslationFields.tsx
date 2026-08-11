"use client"

import React from "react"

type TranslationFieldsProps<T extends object> = {
  value: T
  onChange: (next: T) => void
  fields: Array<{ key: keyof T; label: string; multiline?: boolean; required?: boolean }>
  inputClassName?: string
}

const LANGS = [
  { code: "en", label: "English" },
  { code: "ka", label: "Georgian (ქართული)" },
] as const

export default function TranslationFields<T extends object>({ value, onChange, fields, inputClassName = "" }: TranslationFieldsProps<T>) {
  return (
    <div className="border border-dp-border rounded-sm p-4 flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-dp-text-primary">Translations</p>
        <p className="text-[11px] text-dp-text-tertiary mt-1">Add Georgian content. Empty fields use the English version automatically.</p>
      </div>
      {fields.map((field) => (
        <div key={String(field.key)} className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-dp-text-tertiary">
            {field.label}
            {field.required && <span className="text-dp-accent-cta"> *</span>}
          </label>
          {field.multiline ? (
            <textarea
              required={field.required}
              rows={4}
              value={String(value[field.key] ?? "")}
              onChange={(e) => onChange({ ...value, [field.key]: e.target.value })}
              className={inputClassName}
            />
          ) : (
            <input
              required={field.required}
              value={String(value[field.key] ?? "")}
              onChange={(e) => onChange({ ...value, [field.key]: e.target.value })}
              className={inputClassName}
            />
          )}
        </div>
      ))}
      <div className="flex gap-2 text-[10px] text-dp-text-tertiary">
        {LANGS.map((lang) => <span key={lang.code} className="px-2 py-1 border border-dp-border rounded-sm">{lang.code.toUpperCase()} · {lang.label}</span>)}
      </div>
    </div>
  )
}
