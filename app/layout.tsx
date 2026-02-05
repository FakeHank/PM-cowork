import type { Metadata } from "next";
import "./globals.css";
import { MARKDOWN_CSS_FILE, readText } from "@/lib/fs";

export const metadata: Metadata = {
  title: "PMWork - AI Workstation for Product Managers",
  description: "From ideas to specs to prototypes",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const markdownCss = (await readText(MARKDOWN_CSS_FILE)) ?? "";
  return (
    <html lang="en">
      <head>
        <style
          id="pmwork-markdown-css"
          dangerouslySetInnerHTML={{ __html: markdownCss }}
        />
      </head>
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
