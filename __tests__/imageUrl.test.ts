/**
 * Unit test suite for Image URL Resolution, Header generation, and Selfie URL extraction.
 */

import {
	extractSelfieUrl,
	getImageHeaders,
	getImageSource,
	resolveImageUrl,
} from "../utils/imageUrl";

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

export async function runImageUrlTests(): Promise<void> {
	// 1. Null / undefined / blank values return null
	{
		assert(resolveImageUrl(null) === null, "Expected null for null input");
		assert(resolveImageUrl(undefined) === null, "Expected null for undefined input");
		assert(resolveImageUrl("") === null, "Expected null for empty string");
		assert(resolveImageUrl("   ") === null, "Expected null for whitespace string");
	}

	// 2. Full HTTPS and HTTP URLs return unchanged
	{
		const httpsUrl = "https://bucket.s3.amazonaws.com/kyc/selfie_123.jpg";
		assert(resolveImageUrl(httpsUrl) === httpsUrl, "Expected full HTTPS url to return unchanged");

		const httpUrl = "http://mycdn.net/images/user.png";
		assert(resolveImageUrl(httpUrl) === httpUrl, "Expected full HTTP url to return unchanged");
	}

	// 3. Base64 Data URIs and local file URIs return unchanged
	{
		const dataUri = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...";
		assert(resolveImageUrl(dataUri) === dataUri, "Expected data URI to return unchanged");

		const fileUri = "file:///data/user/0/com.rapidmoney.app/cache/selfie.jpg";
		assert(resolveImageUrl(fileUri) === fileUri, "Expected local file URI to return unchanged");
	}

	// 4. Raw base64 strings with magic prefixes get formatted with data URI scheme
	{
		const rawJpeg = "/9j/4AAQSkZJRgABAQEASABIAAD";
		assert(
			resolveImageUrl(rawJpeg) === `data:image/jpeg;base64,${rawJpeg}`,
			"Expected raw JPEG base64 to be prefixed with data:image/jpeg;base64,"
		);

		const rawPng = "iVBORw0KGgoAAAANSUhEUgAAAAE";
		assert(
			resolveImageUrl(rawPng) === `data:image/png;base64,${rawPng}`,
			"Expected raw PNG base64 to be prefixed with data:image/png;base64,"
		);
	}

	// 5. Relative paths resolve against API URL domain base
	{
		const relativeWithSlash = "/uploads/selfies/selfie_456.jpg";
		const resolvedWithSlash = resolveImageUrl(relativeWithSlash);
		assert(typeof resolvedWithSlash === "string", "Expected resolved URL string");
		assert(
			resolvedWithSlash!.endsWith("/uploads/selfies/selfie_456.jpg"),
			`Expected resolved url to end with relative path, got: ${resolvedWithSlash}`
		);
		assert(
			!resolvedWithSlash!.includes("/api/v1/uploads"),
			`Expected resolved url NOT to include /api/v1 for uploads path, got: ${resolvedWithSlash}`
		);

		const relativeWithoutSlash = "uploads/selfies/selfie_789.jpg";
		const resolvedWithoutSlash = resolveImageUrl(relativeWithoutSlash);
		assert(
			resolvedWithoutSlash!.endsWith("/uploads/selfies/selfie_789.jpg"),
			`Expected resolved url to normalize leading slash, got: ${resolvedWithoutSlash}`
		);
	}

	// 6. getImageHeaders attaches ngrok bypass header when needed
	{
		assert(getImageHeaders(null) === undefined, "Null URL should have no headers");
		assert(
			getImageHeaders("https://s3.amazonaws.com/pic.jpg") === undefined,
			"Non-ngrok URL should have no headers"
		);
		const ngrokHeaders = getImageHeaders("https://test-subdomain.ngrok-free.dev/uploads/selfie.jpg");
		assert(
			ngrokHeaders?.["ngrok-skip-browser-warning"] === "true",
			"ngrok URL must include ngrok-skip-browser-warning header"
		);
	}

	// 7. extractSelfieUrl extracts candidate URL from various backend formats
	{
		assert(extractSelfieUrl(null) === null, "Expected null for null source");
		assert(
			extractSelfieUrl("https://example.com/me.jpg") === "https://example.com/me.jpg",
			"Expected string source to return trimmed string"
		);
		assert(
			extractSelfieUrl({ selfie_url: "/uploads/selfie.jpg" }) === "/uploads/selfie.jpg",
			"Expected selfie_url to be extracted"
		);
		assert(
			extractSelfieUrl({ selfie_upload_url: "/uploads/upload.jpg" }) === "/uploads/upload.jpg",
			"Expected selfie_upload_url to be extracted"
		);
		assert(
			extractSelfieUrl({ data: { selfie_url: "https://example.com/nested.jpg" } }) ===
				"https://example.com/nested.jpg",
			"Expected nested data.selfie_url to be extracted"
		);
		assert(
			extractSelfieUrl({ data: { file_url: "/uploads/file.png" } }) === "/uploads/file.png",
			"Expected nested data.file_url to be extracted"
		);
	}

	// 8. getImageSource returns React Native Image source object
	{
		assert(getImageSource(null) === null, "Expected null source for null input");
		const s3Source = getImageSource("https://s3.amazonaws.com/pic.jpg");
		assert(s3Source?.uri === "https://s3.amazonaws.com/pic.jpg", "Expected uri in source");
		assert(s3Source?.headers === undefined, "Expected no headers for standard S3 source");

		const ngrokSource = getImageSource("https://myhost.ngrok.app/pic.jpg");
		assert(
			ngrokSource?.headers?.["ngrok-skip-browser-warning"] === "true",
			"Expected ngrok headers in source"
		);
	}
}
