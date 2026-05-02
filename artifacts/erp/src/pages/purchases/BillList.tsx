import VoucherList from "@/components/VoucherList";

export default function BillList() {
  return (
    <VoucherList
      voucherType="purchases/bills"
      title="Purchase Bills"
      createHref="/purchases/bills/new"
      viewHref={(id) => `/purchases/bills/${id}`}
      isIncome={false}
    />
  );
}
