"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { showToast } from "@/lib/toastStore";

export function useCategories(userId: string) {
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    supabase
      .from("user_categories")
      .select("name")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .then(({ data, error }: { data: { name: string }[] | null; error: unknown }) => {
        if (!error && data) {
          setCustomCategories(data.map((d: { name: string }) => d.name));
        }
        setLoading(false);
      });
  }, [userId]);

  // Merge: default categories first, then any custom ones not already in the list
  const allCategories: string[] = [
    ...DEFAULT_CATEGORIES,
    ...customCategories.filter((c) => !(DEFAULT_CATEGORIES as readonly string[]).includes(c)),
  ];

  const addCategory = useCallback(
    async (name: string): Promise<boolean> => {
      const trimmed = name.trim();
      if (!trimmed) return false;

      if (allCategories.map((c) => c.toLowerCase()).includes(trimmed.toLowerCase())) {
        showToast("Yeh category pehle se maujood hai", "warning");
        return false;
      }

      const { error } = await supabase
        .from("user_categories")
        .insert({ user_id: userId, name: trimmed });

      if (error) {
        showToast("Category add nahi hui, dobara try karo", "error");
        return false;
      }

      setCustomCategories((prev) => [...prev, trimmed]);
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, allCategories.join(",")]
  );

  const deleteCategory = useCallback(
    async (name: string): Promise<boolean> => {
      const { error } = await supabase
        .from("user_categories")
        .delete()
        .eq("user_id", userId)
        .eq("name", name);

      if (error) {
        showToast("Category delete nahi hui", "error");
        return false;
      }

      setCustomCategories((prev) => prev.filter((c) => c !== name));
      return true;
    },
    [userId]
  );

  return { allCategories, customCategories, addCategory, deleteCategory, loading };
}
