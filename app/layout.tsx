import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata={title:"Savrdh Credit Resolution",description:"Take control of your credit with bank-grade credit report analysis, dispute support and resolution tracking.",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
