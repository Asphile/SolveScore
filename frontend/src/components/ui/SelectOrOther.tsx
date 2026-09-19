import { useEffect, useState } from "react";

const OTHER_OPTION = "Other (specify)";

interface SelectOrOtherProps {
  value: string;
  options: string[];
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}

/** A dropdown of common choices with a "specify your own" text fallback --
 * cuts down on free typing for fields with a well-known set of likely values
 * (grade, role, category, etc.) without ever blocking an uncommon answer. */
export function SelectOrOther({ value, options, disabled, placeholder = "Select...", onChange }: SelectOrOtherProps) {
  const [otherMode, setOtherMode] = useState(value !== "" && !options.includes(value));

  useEffect(() => {
    if (value !== "" && !options.includes(value)) setOtherMode(true);
  }, [value, options]);

  if (otherMode) {
    return (
      <div className="flex gap-2">
        <input disabled={disabled} value={value} placeholder="Please specify" onChange={(e) => onChange(e.target.value)} autoFocus />
        {!disabled && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setOtherMode(false);
              onChange("");
            }}
          >
            Choose from list
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      disabled={disabled}
      value={value}
      onChange={(e) => {
        if (e.target.value === OTHER_OPTION) {
          setOtherMode(true);
          onChange("");
        } else {
          onChange(e.target.value);
        }
      }}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value={OTHER_OPTION}>{OTHER_OPTION}</option>
    </select>
  );
}
