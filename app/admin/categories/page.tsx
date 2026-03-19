"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Category, CategoryFormData, CategoryType } from "@/types";

const EMOJI_OPTIONS = ["💰","💵","🏦","📈","📉","🛒","🍜","🍕","🚗","🏥","💊","📚","🎮","💡","🛍️","✈️","🏠","💼","🎓","🎵","🏋️","🌺","💎","🔧","📱","🎁"];

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryFormData>({
    name: "",
    name_lao: "",
    type: "expense",
    icon: "💰",
    color: "#6366F1",
  });
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/categories");
      if (res.ok) {
        const data = await res.json() as { categories: Category[] };
        setCategories(data.categories ?? []);
      }
    } catch {
      toast.error("ດຶງຂໍ້ມູນໝວດໝູ່ບໍ່ໄດ້");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  const openCreate = () => {
    setEditingCategory(null);
    setForm({ name: "", name_lao: "", type: "expense", icon: "💰", color: "#6366F1" });
    setDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCategory(cat);
    setForm({
      name: cat.name,
      name_lao: cat.name_lao ?? "",
      type: cat.type,
      icon: cat.icon,
      color: cat.color,
      sort_order: cat.sort_order,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const url = editingCategory
        ? `/api/admin/categories/${editingCategory.id}`
        : "/api/admin/categories";
      const method = editingCategory ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        toast.success(editingCategory ? "ອັບເດດໝວດໝູ່ສຳເລັດ" : "ສ້າງໝວດໝູ່ໃໝ່ສຳເລັດ");
        setDialogOpen(false);
        void fetchCategories();
      } else {
        toast.error("ບໍ່ສຳເລັດ");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("ລຶບໝວດໝູ່ນີ້?")) return;
    const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("ລຶບສຳເລັດ");
      void fetchCategories();
    } else {
      toast.error("ລຶບບໍ່ໄດ້");
    }
  };

  const typeLabel: Record<CategoryType, string> = {
    income: "ລາຍຮັບ",
    expense: "ລາຍຈ່າຍ",
    both: "ທັງສອງ",
  };

  const typeBadgeVariant: Record<CategoryType, "income" | "expense" | "default"> = {
    income: "income",
    expense: "expense",
    both: "default",
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ໝວດໝູ່</h1>
          <p className="text-sm text-muted-foreground mt-1">ຈັດການໝວດໝູ່ລາຍຮັບ-ລາຍຈ່າຍ</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          ເພີ່ມໝວດໝູ່
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat, index) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="rounded-xl border bg-card p-4 flex items-center justify-between group hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                  style={{ backgroundColor: `${cat.color}20` }}
                >
                  {cat.icon}
                </div>
                <div>
                  <p className="font-medium text-sm">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">{cat.name_lao}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={typeBadgeVariant[cat.type]} className="text-xs">
                  {typeLabel[cat.type]}
                </Badge>
                <button
                  onClick={() => openEdit(cat)}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {!cat.is_default && (
                  <button
                    onClick={() => handleDelete(cat.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "ແກ້ໄຂໝວດໝູ່" : "ສ້າງໝວດໝູ່ໃໝ່"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>ຊື່ (ອັງກິດ)</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Food"
                />
              </div>
              <div className="space-y-1.5">
                <Label>ຊື່ (ລາວ)</Label>
                <Input
                  value={form.name_lao ?? ""}
                  onChange={(e) => setForm({ ...form, name_lao: e.target.value })}
                  placeholder="ອາຫານ"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>ປະເພດ</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as CategoryType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">ລາຍຮັບ</SelectItem>
                  <SelectItem value="expense">ລາຍຈ່າຍ</SelectItem>
                  <SelectItem value="both">ທັງສອງ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>ໄອຄອນ</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setForm({ ...form, icon: emoji })}
                    className={`h-9 w-9 rounded-lg text-xl flex items-center justify-center transition-all ${
                      form.icon === emoji
                        ? "bg-primary/20 ring-2 ring-primary"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>ສີ</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-10 w-14 cursor-pointer rounded-md border border-input"
                />
                <Input
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  placeholder="#6366F1"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ຍົກເລີກ</Button>
            <Button onClick={handleSave} loading={saving}>
              {editingCategory ? "ອັບເດດ" : "ສ້າງ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
