"use client";

export function Button({ children, onClick, type = "button", disabled }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
