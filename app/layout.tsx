import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const matter = DM_Sans({
  variable: "--font-matter",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Aria",
  description:
    "Aria turns your resume and a target role into a closed loop: a tailored resume, resume-grounded interview practice, and a single readiness signal.",
};

export const viewport: Viewport = {
  themeColor: "#14110f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${matter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-pitch-black">{children}</body>
    </html>
  );
}
