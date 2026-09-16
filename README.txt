SPORT_SHAKIBI — نسخه آماده GitHub + Cloudflare Pages

فایل‌های اصلی سایت در ریشه پروژه قرار دارند. _worker.js حالت Advanced Pages را فعال می‌کند و API فروشگاه را مدیریت می‌کند.

بعد از اتصال Repository به Cloudflare Pages:
1) Build command را خالی بگذار.
2) Build output directory را / یا ریشه پروژه بگذار.
3) یک D1 database بساز و در Pages > Settings > Bindings آن را با Variable name = DB وصل کن.
4) schema.sql را در D1 Console اجرا کن.
5) در Variables/Secrets این سه Secret را بساز: ADMIN_USERNAME ، ADMIN_PASSWORD ، SESSION_SECRET.
6) بعد از هر تغییر binding/secret، پروژه را redeploy کن.

نکته امنیتی: ADMIN_PASSWORD و SESSION_SECRET را فقط داخل Cloudflare به صورت Secret وارد کن و در GitHub قرار نده.
