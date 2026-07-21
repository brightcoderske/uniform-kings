import "dotenv/config";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "uniform_kings",
});

const columns = async (table) => new Set((await connection.query(`SHOW COLUMNS FROM \`${table}\``))[0].map((column) => column.Field));
const add = async (table, existing, name, definition) => {
  if (!existing.has(name)) await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${definition}`);
};

const productColumns = await columns("products");
await add("products", productColumns, "brand", "VARCHAR(120) NULL AFTER sku");
await add("products", productColumns, "product_type", "VARCHAR(120) NULL AFTER brand");
await add("products", productColumns, "gender", "VARCHAR(30) NULL AFTER product_type");
await add("products", productColumns, "age_group", "VARCHAR(40) NULL AFTER gender");
await add("products", productColumns, "material", "VARCHAR(160) NULL AFTER age_group");
await add("products", productColumns, "google_product_category", "VARCHAR(190) NULL AFTER material");
await add("products", productColumns, "source_url", "VARCHAR(500) NULL AFTER google_product_category");

const categoryColumns = await columns("categories");
await add("categories", categoryColumns, "seo_title", "VARCHAR(190) NULL AFTER image_path");
await add("categories", categoryColumns, "seo_description", "VARCHAR(300) NULL AFTER seo_title");

const imageColumns = await columns("product_images");
await add("product_images", imageColumns, "source_url", "VARCHAR(500) NULL AFTER alt_text");
await add("product_images", imageColumns, "license_name", "VARCHAR(120) NULL AFTER source_url");
await add("product_images", imageColumns, "credit_text", "VARCHAR(255) NULL AFTER license_name");

await connection.end();
console.log("Catalog fields are ready.");
