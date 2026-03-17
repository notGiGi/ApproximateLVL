import React, { useEffect, useRef, useState } from 'react';

function clampValue(value, min, max) {
  let next = value;
  if (Number.isFinite(min)) next = Math.max(min, next);
  if (Number.isFinite(max)) next = Math.min(max, next);
  return next;
}

function sanitizeInteger(raw) {
  return raw.replace(/[^\d]/g, '');
}

function sanitizeDecimal(raw) {
  let next = raw.replace(/[^0-9.]/g, '');
  const dotIndex = next.indexOf('.');
  if (dotIndex >= 0) {
    next = `${next.slice(0, dotIndex + 1)}${next.slice(dotIndex + 1).replace(/\./g, '')}`;
  }
  return next;
}

function formatNumericValue(value, integer) {
  if (value === '' || value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return integer ? String(Math.trunc(value)) : String(value);
  }
  return String(value);
}

export default function NumericTextInput({
  value,
  onValueChange,
  min,
  max,
  integer = false,
  className = '',
  disabled = false,
  placeholder,
  id,
  name,
  'aria-label': ariaLabel,
  onBlur,
  onFocus,
  ...rest
}) {
  const minValue = Number(min);
  const maxValue = Number(max);
  const resolvedMin = Number.isFinite(minValue) ? minValue : undefined;
  const resolvedMax = Number.isFinite(maxValue) ? maxValue : undefined;
  const [text, setText] = useState(formatNumericValue(value, integer));
  const lastValidValueRef = useRef(formatNumericValue(value, integer));

  useEffect(() => {
    const next = formatNumericValue(value, integer);
    setText(next);
    lastValidValueRef.current = next;
  }, [value, integer]);

  const parseText = (raw) => {
    if (raw === '' || raw === '.') return null;
    const parsed = integer ? parseInt(raw, 10) : parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const commitValue = (raw) => {
    const parsed = parseText(raw);
    if (parsed === null) return null;
    const clamped = clampValue(parsed, resolvedMin, resolvedMax);
    const normalized = integer ? Math.trunc(clamped) : clamped;
    const formatted = formatNumericValue(normalized, integer);
    lastValidValueRef.current = formatted;
    onValueChange?.(normalized, formatted);
    return { normalized, formatted };
  };

  const handleChange = (event) => {
    const rawInput = event.target.value;
    const sanitized = integer ? sanitizeInteger(rawInput) : sanitizeDecimal(rawInput);
    setText(sanitized);

    if (sanitized === '' || sanitized === '.') return;
    commitValue(sanitized);
  };

  const handleBlur = (event) => {
    const parsed = parseText(text);

    if (parsed === null) {
      let fallback = lastValidValueRef.current;
      if (fallback === '') {
        const fallbackNumber = clampValue(
          resolvedMin ?? resolvedMax ?? 0,
          resolvedMin,
          resolvedMax
        );
        fallback = formatNumericValue(fallbackNumber, integer);
        onValueChange?.(fallbackNumber, fallback);
        lastValidValueRef.current = fallback;
      }
      setText(fallback);
    } else {
      const committed = commitValue(text);
      if (committed) {
        setText(committed.formatted);
      }
    }

    onBlur?.(event);
  };

  return (
    <input
      {...rest}
      id={id}
      name={name}
      type="text"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={onFocus}
      inputMode={integer ? 'numeric' : 'decimal'}
      pattern={integer ? '[0-9]*' : '[0-9]*[.]?[0-9]*'}
      className={className}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  );
}
