import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { api } from "@/lib/api";
import PaymentCreate from "./PaymentCreate";
import { Loader2 } from "lucide-react";

interface Props { type: "receipt" | "payment" }

export default function PaymentEdit({ type }: Props) {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<any>(`/payments/${params.id}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  );
  if (!data) return <div className="text-center py-16 text-gray-400">Payment not found</div>;

  return <PaymentCreate type={type} editId={Number(params.id)} initialData={data} />;
}
