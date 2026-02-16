import { Inter } from "next/font/google";

// Setting up a modern, clean font
const inter = Inter({ subsets: ["latin"] });

/**
 * METADATA
 * This controls what the user sees in the browser tab.
 */
export const metadata = {
  title: "DormPulse | Analytics Dashboard",
  description: "Modern campus dorm mention tracking",
  // This ensures the mobile browser address bar matches your brand color
  themeColor: "#667eea",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body 
        className={inter.className} 
        style={{ 
          margin: 0, 
          padding: 0, 
          boxSizing: 'border-box',
          backgroundColor: '#f8fafc' // Subtle off-white background
        }}
      >
        {children}
      </body>
    </html>
  );
}