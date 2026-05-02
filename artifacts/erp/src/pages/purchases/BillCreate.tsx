import VoucherForm from "@/components/VoucherForm";

export default function BillCreate() {
  return (
    <VoucherForm
      voucherType="purchases/bills"
      title="Purchase Bill"
      listHref="/purchases/bills"
    />
  );
}
