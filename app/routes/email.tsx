import type { Route } from "./+types/email";

// POST request to handle validation token
export async function action({ request }: Route.ActionArgs) {
  const url = new URL(request.url);
  const validationToken = url.searchParams.get("validationToken");

  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  return new Response("No validation token", { status: 405 });
}

// Also handle GET requests for validation
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const validationToken = url.searchParams.get("validationToken");

  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
}
