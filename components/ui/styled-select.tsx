"use client";

import React, {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

type OptionLike = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  /** Optional reference image shown in a hover preview (read from the <option>'s data-image attribute). */
  previewUrl?: string;
};

/** Width of the floating hover-preview image (matches CSS .styled-select__preview img). */
const PREVIEW_SIZE = 168;

export interface StyledSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "children"> {
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  children?: ReactNode;
  placeholder?: string;
}

function collectOptions(children: ReactNode): OptionLike[] {
  return React.Children.toArray(children)
    .filter((child): child is ReactElement => React.isValidElement(child))
    .filter((child) => (child.type as string) === "option")
    .map((child) => {
      const props = child.props as {
        value?: string | number;
        children?: ReactNode;
        disabled?: boolean;
        "data-image"?: string;
      };
      return {
        value: props.value === undefined ? "" : String(props.value),
        label: props.children,
        disabled: props.disabled,
        previewUrl: props["data-image"] ? String(props["data-image"]) : undefined,
      };
    });
}

export function StyledSelect({
  value,
  onChange,
  children,
  disabled,
  className,
  placeholder = "请选择",
  id,
  "aria-label": ariaLabel,
  name,
}: StyledSelectProps) {
  const options = useMemo(() => collectOptions(children), [children]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [preview, setPreview] = useState<{ url: string; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selected = options.find((opt) => opt.value === String(value ?? "")) ?? null;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((opt) => opt.value === String(value ?? ""));
    setActiveIndex(idx >= 0 ? idx : 0);
  }, [open, options, value]);

  useEffect(() => {
    if (!open) setPreview(null);
  }, [open]);

  function commit(optionValue: string) {
    onChange?.({ target: { value: optionValue } } as React.ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    setPreview(null);
  }

  function onTriggerKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => {
        let next = i;
        for (let step = 0; step < options.length; step++) {
          next = (next + 1) % options.length;
          if (!options[next]?.disabled) break;
        }
        return next;
      });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => {
        let next = i;
        for (let step = 0; step < options.length; step++) {
          next = (next - 1 + options.length) % options.length;
          if (!options[next]?.disabled) break;
        }
        return next;
      });
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const opt = options[activeIndex];
      if (opt && !opt.disabled) commit(opt.value);
    }
  }

  return (
    <div ref={containerRef} className={`styled-select${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        id={id}
        name={name}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className="styled-select__control"
      >
        <span className="styled-select__value">
          {selected ? (
            selected.label
          ) : (
            <span className="styled-select__placeholder">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={16} className="styled-select__chevron" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={listboxId}
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="styled-select__panel"
            onMouseLeave={() => setPreview(null)}
          >
            {options.map((opt, index) => {
              const isSelected = opt.value === String(value ?? "");
              const isActive = index === activeIndex;
              return (
                <li
                  key={`${opt.value}_${index}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled}
                  onMouseEnter={(event) => {
                    if (!opt.disabled) setActiveIndex(index);
                    if (opt.previewUrl) {
                      const rect = event.currentTarget.getBoundingClientRect();
                      const placeLeft = rect.right + 8 + PREVIEW_SIZE > window.innerWidth;
                      const x = placeLeft ? rect.left - PREVIEW_SIZE - 8 : rect.right + 8;
                      setPreview({ url: opt.previewUrl, x, y: rect.top });
                    } else {
                      setPreview(null);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (!opt.disabled) commit(opt.value);
                  }}
                  className={[
                    "styled-select__option",
                    isActive && !opt.disabled ? "is-active" : "",
                    isSelected ? "is-selected" : "",
                    opt.disabled ? "is-disabled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="styled-select__option-label">{opt.label}</span>
                  {isSelected && <Check size={14} className="styled-select__check" />}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
      {preview && (
        <div className="styled-select__preview" style={{ left: preview.x, top: preview.y }}>
          <img src={preview.url} alt="" />
        </div>
      )}
    </div>
  );
}

export default StyledSelect;
