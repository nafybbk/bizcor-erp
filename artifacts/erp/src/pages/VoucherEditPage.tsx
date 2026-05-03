import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { api } from "@/lib/api";
import VoucherForm from "@/components/VoucherForm";
import { Loader2 } from "lucide-react";

interface Props {
  voucherType: "sales/invoices" | "sales/credit-notes" | "purchases/bills" | "purchases/debit-notes";
  title: string;
  listHref: string;
}

export default function VoucherEditPage({ voucherType, title, listHref }: Props) {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<any>(`/${voucherType}/${params.id}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  );
  if (!data) return <div className="text-center py-16 text-gray-400">Voucher not found</div>;

  return (
    <VoucherForm
      voucherType={voucherType}
      title={title}
      listHref={listHref}
      editId={Number(params.id)}
      initialData={data}
    />
  );
}
