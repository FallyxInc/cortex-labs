import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
	const host = request.headers.get("host");

	// always redirect to pilot domain
	return NextResponse.redirect(
		new URL("https://app.ascenix.co", request.url),
		301,
	);

	// Redirect Railway subdomain to custom domain in production
	// if (host === "fallyx-behaviours.up.railway.app") {
	// 	console.log("Redirecting from Railway to custom domain");
	// 	const url = new URL("https://behaviours.ascenix.co");
	// 	console.log("Redirecting to:", url.toString());
	// 	return NextResponse.redirect(url, 301);
	// }

	// const { pathname } = request.nextUrl;

	// // Allow access to login, reset-password, and unauthorized pages
	// if (
	// 	pathname === "/login" ||
	// 	pathname === "/reset-password" ||
	// 	pathname === "/unauthorized" ||
	// 	pathname.startsWith("/_next") ||
	// 	pathname.startsWith("/api") ||
	// 	pathname.startsWith("/assets")
	// ) {
	// 	return NextResponse.next();
	// }

	// // Redirect root to login
	// if (pathname === "/") {
	// 	return NextResponse.redirect(new URL("/login", request.url));
	// }

	// // All other routes require authentication (handled client-side with Firebase)
	// return NextResponse.next();
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
