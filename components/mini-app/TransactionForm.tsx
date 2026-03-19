"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Calendar, Tag } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { Category, TransactionType } from "@/types";

interface TransactionFormProps {
  initialType?: TransactionType;
  categories: Category[];
  onSubmit: (data: {
    type: TransactionType;
    amount: number;
    category_id: string;
    description: string;
    transaction_date: string;
  }) => Promise<void>;
  onCancel?: () => void;
}

export function TransactionForm({
  initialType = "expense",
  categories,
  onSubmit,
  onCancel,
}: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  const filteredCategories = categories.filter(
    (c) => c.type === type || c.type === "both"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId) return;

    setLoading(true);
    try {
      await onSubmit({
        type,
        amount: parseInt(amount.replace(/,/g, ""), 10),
        category_id: categoryId,
        description,
        transaction_date: date,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    if (raw) {
      setAmount(new Intl.NumberFormat("lo-LA").format(parseInt(raw, 10)));
    } else {
      setAmount("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type Toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setType("income")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all",
            type === "income"
              ? "bg-emerald-500 text-white shadow-md"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          <TrendingUp className="h-4 w-4" />
          ລາຍຮັບ
        </button>
        <button
          type="button"
          onClick={() => setType("expense")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all",
            type === "expense"
              ? "bg-red-500 text-white shadow-md"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          <TrendingDown className="h-4 w-4" />
          ລາຍຈ່າຍ
        </button>
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <Label>ຈຳນວນ (ກີບ)</Label>
        <div className="relative">
          <Input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={handleAmountChange}
            className="text-xl font-bold number-font pr-16 h-14"
            required
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
            ກີບ
          </span>
        </div>
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5" />
          ໝວດໝູ່
        </Label>
        <Select value={categoryId} onValueChange={setCategoryId} required>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="ເລືອກໝວດໝູ່" />
          </SelectTrigger>
          <SelectContent>
            {filteredCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <span className="flex items-center gap-2">
                  <span>{cat.icon}</span>
                  <span>{cat.name_lao ?? cat.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label>ລາຍລະອຽດ</Label>
        <Input
          placeholder="ເຊັ່ນ: ຊື້ເຂົ້າ, ຄ່ານ້ຳ..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-11"
        />
      </div>

      {/* Date */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          ວັນທີ
        </Label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-11"
          required
        />
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-12">
            ຍົກເລີກ
          </Button>
        )}
        <motion.div className={cn("flex-1", !onCancel && "w-full")} whileTap={{ scale: 0.98 }}>
          <Button
            type="submit"
            loading={loading}
            className={cn(
              "w-full h-12 text-base font-semibold",
              type === "income" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"
            )}
          >
            {loading ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
          </Button>
        </motion.div>
      </div>
    </form>
  );
}
