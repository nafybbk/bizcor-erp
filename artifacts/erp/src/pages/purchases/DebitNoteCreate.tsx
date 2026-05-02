import VoucherForm from "@/components/VoucherForm";

export default function DebitNoteCreate() {
  return (
    <VoucherForm
      voucherType="purchases/debit-notes"
      title="Debit Note"
      listHref="/purchases/debit-notes"
    />
  );
}
