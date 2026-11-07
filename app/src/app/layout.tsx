import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata = {
  title: "Read Before You Sign",
  description: "See what a Solana transaction actually does before you approve it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
