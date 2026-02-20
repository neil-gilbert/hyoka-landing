import type { APIRoute } from 'astro';

export const prerender = false;

const RESEND_API_ENDPOINT = 'https://api.resend.com/emails';

function isValidEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeSourcePath(value: FormDataEntryValue | null): string {
	if (typeof value !== 'string') {
		return '/';
	}

	const trimmed = value.trim();
	if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
		return '/';
	}

	const [pathOnly] = trimmed.split('?');
	const collapsed = pathOnly.replace(/\/{2,}/g, '/');
	const normalized = collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : collapsed;
	return normalized || '/';
}

function buildRedirectURL(requestURL: URL, path: string, joined: '0' | '1', error?: string): URL {
	const redirectURL = new URL(path, requestURL);
	redirectURL.searchParams.set('joined', joined);
	if (error) {
		redirectURL.searchParams.set('error', error);
	}
	return redirectURL;
}

export const POST: APIRoute = async ({ request, locals }) => {
	const requestURL = new URL(request.url);
	const formData = await request.formData();

	const email = String(formData.get('email') ?? '').trim().toLowerCase();
	const sourcePath = normalizeSourcePath(formData.get('sourcePath'));

	if (!isValidEmail(email)) {
		const redirectURL = buildRedirectURL(requestURL, sourcePath, '0', 'invalid_email');
		return Response.redirect(redirectURL, 303);
	}

	const runtimeEnv = locals.runtime?.env;
	const resendApiKey = runtimeEnv?.RESEND_API_KEY ?? import.meta.env.RESEND_API_KEY;
	const waitlistNotifyEmail =
		runtimeEnv?.WAITLIST_NOTIFY_EMAIL ?? import.meta.env.WAITLIST_NOTIFY_EMAIL;
	const waitlistFromEmail = runtimeEnv?.WAITLIST_FROM_EMAIL ?? import.meta.env.WAITLIST_FROM_EMAIL;

	if (!resendApiKey || !waitlistNotifyEmail) {
		const redirectURL = buildRedirectURL(requestURL, sourcePath, '0', 'email_not_configured');
		return Response.redirect(redirectURL, 303);
	}

	const messageText = [
		'A new waitlist signup was submitted on hyoka.co.uk.',
		`Email: ${email}`,
		`Source path: ${sourcePath}`,
		`Submitted at (UTC): ${new Date().toISOString()}`,
	].join('\n');

	const resendResponse = await fetch(RESEND_API_ENDPOINT, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${resendApiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			from: waitlistFromEmail || 'Hyoka Waitlist <onboarding@resend.dev>',
			to: [waitlistNotifyEmail],
			subject: 'New Hyoka waitlist signup',
			text: messageText,
			reply_to: email,
		}),
	});

	if (!resendResponse.ok) {
		const errorBody = await resendResponse.text();
		console.error('Waitlist email send failed', resendResponse.status, errorBody);
		const redirectURL = buildRedirectURL(requestURL, sourcePath, '0', 'delivery_failed');
		return Response.redirect(redirectURL, 303);
	}

	const redirectURL = buildRedirectURL(requestURL, sourcePath, '1');
	return Response.redirect(redirectURL, 303);
};
