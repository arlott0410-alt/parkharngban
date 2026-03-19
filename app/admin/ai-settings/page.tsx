"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Play, Save, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/gemini";
import type { GeminiParseResponse } from "@/types";

const TEST_EXAMPLES = [
  "ຈ່າຍ 50,000 ຊື້ເຂົ້າກິນ",
  "ໄດ້ເງິນເດືອນ 1,500,000",
  "จ่ายค่าน้ำไฟ 85,000",
  "ได้เงินจากลูกค้า 200,000",
  "ຊື້ຢາ 30,000 ກີບ",
];

export default function AdminAISettingsPage() {
  const [prompt, setPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<GeminiParseResponse | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleTest = async () => {
    if (!testInput.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/gemini/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: testInput, customPrompt: prompt }),
      });
      const data = await res.json() as GeminiParseResponse;
      setTestResult(data);
    } catch {
      toast.error("Test ບໍ່ສຳເລັດ");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (res.ok) {
        toast.success("ບັນທຶກ Prompt ສຳເລັດ");
      } else {
        toast.error("ບັນທຶກບໍ່ສຳເລັດ");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPrompt(DEFAULT_SYSTEM_PROMPT);
    toast.info("Reset prompt ແລ້ວ");
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Settings</h1>
          <p className="text-sm text-muted-foreground">ຕັ້ງຄ່າ Gemini Prompt ສຳລັບການ parse ລາຍຮັບ-ລາຍຈ່າຍ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prompt Editor */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                System Prompt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={18}
                className="font-mono text-xs resize-none"
                placeholder="ຂຽນ prompt ສຳລັບ Gemini..."
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  loading={saving}
                  className="flex-1 gap-2"
                >
                  <Save className="h-4 w-4" />
                  ບັນທຶກ
                </Button>
                <Button variant="outline" onClick={handleReset} className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Test Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Play className="h-4 w-4 text-emerald-500" />
                Test Prompt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quick examples */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">ຕົວຢ່າງ ClickToTest</Label>
                <div className="flex flex-wrap gap-2">
                  {TEST_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setTestInput(ex)}
                      className="rounded-md bg-muted px-2.5 py-1 text-xs hover:bg-muted/80 transition-colors text-left"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>ຂໍ້ຄວາມ Input</Label>
                <div className="flex gap-2">
                  <Input
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="ພິມຂໍ້ຄວາມ..."
                    onKeyDown={(e) => e.key === "Enter" && handleTest()}
                  />
                  <Button
                    onClick={handleTest}
                    loading={testing}
                    className="gap-1.5 shrink-0"
                    disabled={!testInput.trim()}
                  >
                    <Play className="h-4 w-4" />
                    Test
                  </Button>
                </div>
              </div>

              {/* Result */}
              {testResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className={`rounded-xl p-4 border ${
                    testResult.success
                      ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                      : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
                  }`}>
                    {testResult.success && testResult.transaction ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={testResult.transaction.type === "income" ? "income" : "expense"}>
                            {testResult.transaction.type === "income" ? "ລາຍຮັບ" : "ລາຍຈ່າຍ"}
                          </Badge>
                          <span className="text-sm font-mono font-bold">
                            {new Intl.NumberFormat("lo-LA").format(testResult.transaction.amount)} ກີບ
                          </span>
                        </div>
                        <p className="text-sm">{testResult.transaction.description}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <span>ໝວດ: {testResult.transaction.category_hint ?? "—"}</span>
                          <span>ຄວາມໝັ້ນໃຈ: {Math.round(testResult.transaction.confidence * 100)}%</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-red-600 dark:text-red-400">{testResult.error}</p>
                    )}
                  </div>

                  {testResult.raw_response && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Raw Response
                      </summary>
                      <pre className="mt-2 rounded-lg bg-muted p-3 overflow-auto text-xs">
                        {testResult.raw_response}
                      </pre>
                    </details>
                  )}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
