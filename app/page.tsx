import Link from "next/link";
import { Card, PageShell, buttonClass } from "@/components/ui";

// Project information page for evaluators. Customers never pass through here:
// they reach their tipping page directly by scanning the QR code on their receipt.
export default function Home() {
  return (
    <PageShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">QuietTip prototype</h1>
          <p>
            QuietTip is a private, optional way to tip <em>after</em> a purchase is complete. Customers scan the QR
            code on their printed receipt with their phone camera, and their browser opens the tipping page for that
            receipt. There is no sign-in and no start screen.
          </p>
        </div>

        <Card className="space-y-2">
          <h2 className="text-lg font-semibold">About this prototype</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>The cafe, receipts, purchases, and employee pooling policy are fictional.</li>
            <li>Tips are a separate payment through Stripe Checkout in test mode. No real money moves.</li>
            <li>Receipt links are private bearer links. They are not listed on this site.</li>
          </ul>
        </Card>

        <Link href="/demo/employee" className={buttonClass("secondary")}>
          Employee transparency demo
        </Link>
      </div>
    </PageShell>
  );
}
