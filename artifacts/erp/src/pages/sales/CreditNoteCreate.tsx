import VoucherForm from "@/components/VoucherForm";

export default function CreditNoteCreate() {
  return (
    <VoucherForm
      voucherType="sales/credit-notes"
      title="Credit Note"
      listHref="/sales/credit-notes"
    />
  );
}
