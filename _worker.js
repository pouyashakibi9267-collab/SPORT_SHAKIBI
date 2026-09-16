export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/products" && request.method === "GET")
      return productsGet(env);

    if (url.pathname === "/api/products" && request.method === "POST")
      return productsPost(request, env);

    if (url.pathname === "/api/products" && request.method === "DELETE")
      return productsDelete(request, env);

    if (url.pathname === "/api/login" && request.method === "POST")
      return login(request, env);

    if (url.pathname === "/api/logout" && request.method === "POST")
      return logout();

    return env.ASSETS.fetch(request);
  }
};

async function productsGet(env) {
  const { results } = await env.DB
    .prepare("SELECT id,name,category,price,emoji,image FROM products ORDER BY id DESC")
    .all();

  return Response.json(results);
}

async function productsPost(request, env) {
  if (!(await isAdmin(request, env)))
    return new Response("Unauthorized", { status: 401 });

  const b = await request.json();

  if (!b.name || !b.price)
    return Response.json(
      { error: "نام و قیمت الزامی است" },
      { status: 400 }
    );

  const r = await env.DB
    .prepare(
      "INSERT INTO products(name,category,price,emoji,image) VALUES(?,?,?,?,?)"
    )
    .bind(
      b.name,
      b.category || "اسپرت",
      b.price,
      b.emoji || "👕",
      b.image || ""
    )
    .run();

  return Response.json({
    ok: true,
    id: r.meta.last_row_id
  });
}

async function productsDelete(request, env) {
  if (!(await isAdmin(request, env)))
    return new Response("Unauthorized", { status: 401 });

  const id = new URL(request.url).searchParams.get("id");

  if (!id)
    return new Response("Bad request", { status: 400 });

  await env.DB
    .prepare("DELETE FROM products WHERE id=?")
    .bind(id)
    .run();

  return Response.json({ ok: true });
}

async function login(request, env) {
  const { username, password } = await request.json();

  if (
    !env.ADMIN_USERNAME ||
    !env.ADMIN_PASSWORD ||
    !env.SESSION_SECRET ||
    username !== env.ADMIN_USERNAME ||
    password !== env.ADMIN_PASSWORD
  ) {
    return new Response(
      JSON.stringify({ error: "نام کاربری یا رمز عبور اشتباه است" }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }

  const exp = Date.now() + 86400000;
  const payload = b64url(
    JSON.stringify({
      u: username,
      exp
    })
  );

  const sig = await hmac(payload, env.SESSION_SECRET);

  return new Response(
    JSON.stringify({ ok: true }),
    {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `sport_admin=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`
      }
    }
  );
}

function logout() {
  return new Response(
    JSON.stringify({ ok: true }),
    {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "sport_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
      }
    }
  );
}

async function isAdmin(request, env) {
  const m = (request.headers.get("Cookie") || "")
    .match(/(?:^|;\s*)sport_admin=([^;]+)/);

  if (!m || !env.SESSION_SECRET)
    return false;

  const parts = m[1].split(".");

  if (parts.length !== 2)
    return false;

  try {
    const data = JSON.parse(
      new TextDecoder().decode(b64decode(parts[0]))
    );

    if (!data.exp || Date.now() > data.exp)
      return false;

    const expected = await hmac(
      parts[0],
      env.SESSION_SECRET
    );

    return constantEqual(expected, parts[1]);
  } catch {
    return false;
  }
}

async function hmac(data, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const s = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );

  return b64url(s);
}

function b64url(v) {
  const bytes =
    typeof v === "string"
      ? new TextEncoder().encode(v)
      : new Uint8Array(v);

  let s = "";

  for (const b of bytes)
    s += String.fromCharCode(b);

  return btoa(s)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function b64decode(s) {
  s = s
    .replaceAll("-", "+")
    .replaceAll("_", "/");

  while (s.length % 4)
    s += "=";

  const raw = atob(s);
  const a = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i++)
    a[i] = raw.charCodeAt(i);

  return a;
}

function constantEqual(a, b) {
  if (a.length !== b.length)
    return false;

  let x = 0;

  for (let i = 0; i < a.length; i++)
    x |= a.charCodeAt(i) ^ b.charCodeAt(i);

  return x === 0;
}
