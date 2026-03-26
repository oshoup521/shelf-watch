"use client";

import { useCategories } from "@/hooks/useCategories";

interface Props {
  value: string;
  onChange: (val: string) => void;
  userId: string;
  style?: React.CSSProperties;
  className?: string;
}

export default function CategorySelect({
  value,
  onChange,
  userId,
  style,
  className,
}: Props) {
  const { allCategories, loading } = useCategories(userId);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      style={style}
      disabled={loading}
    >
      {allCategories.map((cat) => (
        <option key={cat} value={cat}>
          {cat}
        </option>
      ))}
    </select>
  );
}
