import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { api } from "@/lib/api";
import ExpenseCreate from "./ExpenseCreate";
import { Loader2 } from "lucide-react";

export default function ExpenseEdit() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<any>(`/cash-bank/expenses/${params.id}`).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  if (!data) return <div className="text-gray-400 p-8">Expense not found</div>;

  return <ExpenseCreate editId={data.id} initialData={data} />;
}
