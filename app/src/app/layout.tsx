export const metadata = {
  title: "Read Before You Sign",
  description: "See what a Solana transaction actually does before you approve it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#0e0e11",
          color: "#f0f0f2",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
