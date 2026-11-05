import { notFound } from "next/navigation";
import ReceiptLoading from "@/app/r/[token]/loading";

export const dynamic = "force-dynamic";

// DEVELOPMENT ONLY. Shows the receipt loading screen on its own so it can be inspected.
export default function LoadingStatePreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ReceiptLoading />;
}
