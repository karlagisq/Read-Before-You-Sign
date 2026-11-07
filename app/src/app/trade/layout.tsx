import { TradeProviders } from "@/components/trade/Providers";

export const metadata = { title: "Trade safely · Read Before You Sign" };

export default function TradeLayout({ children }: { children: React.ReactNode }) {
  return <TradeProviders>{children}</TradeProviders>;
}
