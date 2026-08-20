import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import StoreProvider from "./store/StoreProvider";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Word Guesser",
  description: "A Wordle-style word guessing game",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <StoreProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
