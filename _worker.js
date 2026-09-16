export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // PRODUCTS
    if (url.pathname === "/api/products" && request.method === "GET")
      return productsGet(env);

    if (url.pathname === "/api/products" && request.method === "POST")
      return productsPost(request, env);

    if (url.pathname === "/api/products" && request.method === "DELETE")
      return productsDelete(request, env);

    // ORDERS
    if (url.pathname === "/api/orders" && request.method === "POST")
      return ordersPost(request, env);

    if (url.pathname === "/api/orders" && request.method === "GET")
      return ordersGet(request, env);

    if (url.pathname === "/api/orders" && request.method === "PUT")
      return ordersUpdate(request, env);

    if (url.pathname === "/api/orders" && request.method === "DELETE")
      return ordersDelete(request, env);

    // AUTH
    if (url.pathname === "/api/login" && request.method === "POST")
      return login(request, env);

    if (url.pathname === "/api/logout" && request.method === "POST")
      return logout();

    return env.ASSETS.fetch(request);
  }
};


// =========================
// PRODUCTS
// =========================

async function productsGet(env) {
  const { results } = await env.DB
    .prepare(
      "SELECT id,name,category,price,emoji,image FROM products ORDER BY id DESC"
    )
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


// =========================
// ORDERS
// =========================

async function ordersPost(request, env) {
  try {
    const b = await request.json();

    if (
      !b.customer_name ||
      !b.phone ||
      !b.address ||
      !b.items ||
      !b.total
    ) {
      return Response.json(
        {
          error: "اطلاعات سفارش کامل نیست"
        },
        { status: 400 }
      );
    }

    const items =
      typeof b.items === "string"
        ? b.items
        : JSON.stringify(b.items);

    const r = await env.DB
      .prepare(
        `INSERT INTO orders
        (customer_name,phone,address,items,total,status)
        VALUES(?,?,?,?,?,'جدید')`
      )
      .bind(
        b.customer_name,
        b.phone,
        b.address,
        items,
        String(b.total)
      )
      .run();

    return Response.json({
      ok: true,
      order_id: r.meta.last_row_id
    });

  } catch (e) {
    return Response.json(
      {
        error: "خطا در ثبت سفارش"
      },
      { status: 500 }
    );
  }
}


async function ordersGet(request, env) {
  if (!(await isAdmin(request, env)))
    return new Response("Unauthorized", { status: 401 });

  const { results } = await env.DB
    .prepare(
      `SELECT
        id,
        customer_name,
        phone,
        address,
        items,
        total,
        status,
        created_at
       FROM orders
       ORDER BY id DESC`
    )
    .all();

  return Response.json(results);
}


async function ordersUpdate(request, env) {
  if (!(await isAdmin(request, env)))
    return new Response("Unauthorized", { status: 401 });

  const id = new URL(request.url).searchParams.get("id");

  if (!id)
    return Response.json(
      { error: "شناسه سفارش مشخص نیست" },
      { status: 400 }
    );

  const b = await request.json();

  const allowedStatuses = [
    "جدید",
    "در حال بررسی",
    "ارسال شد",
    "تکمیل شد",
    "لغو شد"
  ];

  if (!allowedStatuses.includes(b.status))
    return Response.json(
      { error: "وضعیت سفارش نامعتبر است" },
      { status: 400 }
    );

  await env.DB
    .prepare(
      "UPDATE orders SET status=? WHERE id=?"
    )
    .bind(
      b.status,
      id
    )
    .run();

  return Response.json({
    ok: true
  });
}


async function ordersDelete(request, env) {
  if (!(await isAdmin(request, env)))
    return new Response("Unauthorized", { status: 401 });

  const id = new URL(request.url).searchParams.get("id");

  if (!id)
    return Response.json(
      { error: "شناسه سفارش مشخص نیست" },
      { status: 400 }
    );

  await env.DB
    .prepare("DELETE FROM orders WHERE id=?")
    .bind(id)
    .run();

  return Response.json({
    ok: true
  });
}


// =========================
// LOGIN
// =========================

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
      JSON.stringify({
        error: "نام کاربری یا رمز عبور اشتباه است"
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json"
       
