import type { Metadata } from 'next';
import './globals.css';
import MixpanelProvider from '@/components/MixpanelProvider';

export const metadata: Metadata = {
	title: 'Fallyx Behaviours Dashboard',
	description: 'Behaviour tracking and analysis dashboard',
	icons: {
		icon: [
			{ url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
			{ url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
		],
		apple: '/apple-touch-icon.png',
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			{/* Inter variable font is loaded via @import in globals.css with full weight range (100-900) */}
			{/* Next.js automatically handles preconnect optimization for Google Fonts */}
			<body>
				<MixpanelProvider>{children}</MixpanelProvider>
			</body>
		</html>
	);
}
