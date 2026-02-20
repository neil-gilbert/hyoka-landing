type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

interface Env {
	RESEND_API_KEY?: string;
	WAITLIST_NOTIFY_EMAIL?: string;
	WAITLIST_FROM_EMAIL?: string;
}

declare namespace App {
	interface Locals extends Runtime {}
}
