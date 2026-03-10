import type { Metadata } from "next";

import StyledComponentsRegistry from "@/lib/styled-components-registry";
import { GlobalStyle } from "./styles";

export const metadata: Metadata = {
  title: "Calendar Tasks",
  description: "Calendar grid with inline tasks, drag-and-drop, and holidays",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <StyledComponentsRegistry>
          <GlobalStyle />
          {children}
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
